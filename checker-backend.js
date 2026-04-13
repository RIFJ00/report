/**
 * サーバー/GitHub Actions実行用 バックエンドスクリプト
 * * [役割]
 * 1. CSVからマスタデータ（監視対象のURL）を読み込む
 * 2. 各URLをスクレイピングして最新日付を取得
 * 3. Firestoreに保存されている「前回の最新日付」と比較
 * 4. 新しければSlackへ通知し、Firestoreのデータを更新する
 */

const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

// --- 設定の読み込み ---
const CSV_FILE_PATH = '会議体リスト_20260411.xlsx - in.csv'; // GitHubリポジトリ内のCSVファイル
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const FIREBASE_KEY_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!SLACK_WEBHOOK_URL || !FIREBASE_KEY_JSON) {
  console.error('環境変数 SLACK_WEBHOOK_URL または FIREBASE_SERVICE_ACCOUNT が設定されていません。');
  process.exit(1);
}

// --- Firebase Admin SDK の初期化 ---
const serviceAccount = JSON.parse(FIREBASE_KEY_JSON);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 日付抽出用の正規表現
const dateRegex = /(20\d{2}|令和\s*?\d+|令和\s*?元)年\s*?(\d{1,2})月\s*?(\d{1,2})日/g;

function parseJapaneseDate(dateStr) {
  let year, month, day;
  if (dateStr.includes('令和')) {
    const reiwaYearStr = dateStr.match(/令和\s*?(\d+|元)年/)[1];
    year = reiwaYearStr === '元' ? 2019 : 2018 + parseInt(reiwaYearStr, 10);
  } else {
    year = parseInt(dateStr.match(/(\d{4})年/)[1], 10);
  }
  month = parseInt(dateStr.match(/(\d{1,2})月/)[1], 10) - 1;
  day = parseInt(dateStr.match(/(\d{1,2})日/)[1], 10);
  return new Date(year, month, day);
}

// --- Slack通知関数 ---
async function notifySlack(meetingName, newDateStr, url, agency) {
  const message = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔔 *会議体が更新されました*\n*${meetingName}* (${agency})\nサイト上の最新日付: *${newDateStr}*`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "サイトを確認する" },
            url: url,
            style: "primary"
          }
        ]
      }
    ]
  };
  
  try {
    await axios.post(SLACK_WEBHOOK_URL, message);
    console.log(`Slack通知送信成功: ${meetingName}`);
  } catch (error) {
    console.error(`Slack通知エラー: ${error.message}`);
  }
}

// --- メイン処理 ---
async function runCheck() {
  console.log('--- 会議体更新チェックを開始します ---');
  const records = [];
  
  // 1. CSVデータの読み込み（マスタデータとして利用）
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (row) => records.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  for (const record of records) {
    const url = record['URL'];
    const meetingName = record['会議名'];
    const agency = record['所管'];
    // FirestoreのドキュメントIDとして使用するため、URLをBase64エンコード（スラッシュ等が含まれるため）
    const docId = Buffer.from(url || '').toString('base64').replace(/\//g, '_');

    if (!url || !meetingName) continue;

    try {
      // 2. サイトのスクレイピング
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const $ = cheerio.load(response.data);
      $('script, style, noscript').remove();
      const bodyText = $('body').text();
      
      let match;
      let newestFoundDate = null;
      let newestFoundDateStr = '';

      // ページ内の最新日付を探す
      while ((match = dateRegex.exec(bodyText)) !== null) {
        const foundDateStr = match[0];
        const foundDate = parseJapaneseDate(foundDateStr);
        
        if (!newestFoundDate || foundDate > newestFoundDate) {
           newestFoundDate = foundDate;
           newestFoundDateStr = foundDateStr;
        }
      }

      if (newestFoundDate) {
        // 3. Firestoreから前回データを取得
        const docRef = db.collection('meetings').doc(docId);
        const docSnap = await docRef.get();
        
        let lastDate = new Date(0); // デフォルトは古い日付
        let isExisting = docSnap.exists;
        let existingData = isExisting ? docSnap.data() : null;

        if (isExisting && existingData.latestDateTimestamp) {
          lastDate = new Date(existingData.latestDateTimestamp);
        }

        // 4. 比較して新しければ更新＆通知
        if (newestFoundDate > lastDate) {
          console.log(`[更新あり] ${meetingName}: ${newestFoundDateStr}`);
          
          // Slack通知
          await notifySlack(meetingName, newestFoundDateStr, url, agency);
          
          // Firestore更新
          await docRef.set({
            meetingName: meetingName,
            agency: agency,
            url: url,
            latestDateString: newestFoundDateStr,
            latestDateTimestamp: newestFoundDate.getTime(),
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'updated'
          }, { merge: true });
        } else if (!isExisting) {
          // 新規追加だが日付は古かった場合（初回データ作成）
          await docRef.set({
            meetingName: meetingName,
            agency: agency,
            url: url,
            latestDateString: newestFoundDateStr,
            latestDateTimestamp: newestFoundDate.getTime(),
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'unchanged'
          }, { merge: true });
        } else {
          // 【重要: 節約処理】更新がない場合は、Firestoreへの書き込みをスキップする
          console.log(`[変更なし] ${meetingName} (DB書き込みスキップ)`);
        }
      }
    } catch (error) {
      console.log(`[取得エラー] ${meetingName} (${url}): ${error.message}`);
      
      // 【重要: 節約処理】エラーも毎回書き込まず、新規エラー時のみ記録する
      const docRef = db.collection('meetings').doc(docId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists || docSnap.data().status !== 'error') {
        await docRef.set({
          meetingName: meetingName,
          agency: agency,
          url: url,
          lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'error',
          errorMessage: error.message
        }, { merge: true });
      } else {
        console.log(`[エラー継続] ${meetingName} (DB書き込みスキップ)`);
      }
    }
    
    // サーバー負荷軽減のためのインターバル
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('--- チェックが完了しました ---');
}

runCheck();
