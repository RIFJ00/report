
const $ = id => document.getElementById(id);

// v1.57 compatibility: the original public data.js supplied this map.
// Build it from the authenticated Firestore company master instead of
// publishing the private 387-company source dataset in GitHub Pages.
const COMPANY_DATA = Array.isArray(window.COMPANY_DATA) ? window.COMPANY_DATA : [];
const INDUSTRY_DEFAULTS = (() => {
  const names = new Set(["その他・複合"]);
  COMPANY_DATA.forEach(c => {
    if (typeof c.industry === "string" && c.industry.trim()) names.add(c.industry.trim());
    if (Array.isArray(c.search_tags)) c.search_tags.forEach(t => {
      if (typeof t === "string" && t.trim()) names.add(t.trim());
    });
  });
  const defaults = {};
  names.forEach(name => {
    const matching = COMPANY_DATA.filter(c =>
      c.industry === name || (Array.isArray(c.search_tags) && c.search_tags.includes(name))
    );
    const sample = matching.find(c => c.sales_theme || c.demo || c.dept1) || {};
    defaults[name] = {
      dept: sample.dept1 || "経営企画・政策渉外等",
      theme: sample.sales_theme || name,
      demo: sample.demo || "御社に関連する政府資料を2～3件確認"
    };
  });
  return defaults;
})();

const SIGNATURE = `◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇
一般社団法人日本みらい研事務局
東京都千代田区平河町2-16-6 jeＶビル７F
代表理事　高松重雄
TEL 03(5215)6071　FAX 03(5215)6072
Mail s-takamatsu@rifj.jp

一般社団法人日本みらい研 https://www.rifj.jp/
政策リサーチのご案内 https://report.rifj.jp/pr/
◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇`;
const LEGACY_CONNECTION_TEXT = `私は以前、永田町で国会議員の政策秘書として長く勤務しており、その当時、御社とも若干のご縁をいただいた記憶がございます。かなり以前のことですので、当時ご対応いただいた方のお名前までは思い出せないのですが、その頃のご縁を思い出しながら、今回改めてご連絡を差し上げました。`;
function hasLegacyConnection(c){ return !!(c && (c.legacyConnection || c.legacy_connection)); }
function legacyConnectionParagraph(c){ return hasLegacyConnection(c) ? LEGACY_CONNECTION_TEXT : ""; }
const SALES_SERVICE_INTRO = `私は、長年国会議員の政策秘書を勤めており、その経験を踏まえて開発した、政府・省庁・国会などの政策情報を収集・整理する法人向けサービス「政策リサーチ」を10年以上運営しております。現在、大手企業だけでも150社前後に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。`;
const LEGACY_SERVICE_INTRO = `現在は、その経験を踏まえて開発した、政府・省庁・国会などの政策情報を収集・整理する法人向けサービス「政策リサーチ」を10年以上運営しております。現在、大手企業だけでも150社前後に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。`;
function salesIntroduction(c){
  if(hasLegacyConnection(c)) return `${LEGACY_CONNECTION_TEXT}\n\n${LEGACY_SERVICE_INTRO}`;
  return SALES_SERVICE_INTRO;
}
function salesRelevantMaterials(theme){
  return `御社では、「${theme}」に関連する事業などが、政府や省庁の情報に関係が深いと考え、一般的なシステムの説明というより、御社に関係する政府関連資料を2～3件ご説明できればと思い、ご連絡をさせていただきました。また、他に関心の深い分野などがあれば教えてもらえますか。`;
}


let BULK_SELECTED = new Set();
let LAST_BATCH_DOCS = [];
const PROGRESS_STORAGE_KEY = "rifj_policy_sales_progress_v1";
const PROGRESS_DB_NAME = "rifj_policy_sales_db_v1";
const PROGRESS_DB_STORE = "kv";
const COMPANY_RENAME_MAP = {"KDDI":"KDDI株式会社","TDK":"TDK株式会社","TIS":"TIS株式会社","ソフトバンク":"ソフトバンク株式会社","ダイキン工業":"ダイキン工業株式会社","大日本印刷":"大日本印刷株式会社","富士通":"富士通株式会社","岩谷産業":"岩谷産業株式会社","川崎重工業":"川崎重工業株式会社","日立製作所":"株式会社日立製作所","日鉄ソリューションズ":"日鉄ソリューションズ株式会社","東芝":"株式会社東芝","沖電気工業":"沖電気工業株式会社","関西電力":"関西電力株式会社","ANAホールディングス":"ANAホールディングス株式会社","LIXIL":"株式会社LIXIL","freee":"freee株式会社","インフォマート":"株式会社インフォマート","エムティーアイ":"株式会社エムティーアイ","ジェイティービー":"株式会社ジェイティービー","ジャパンディスプレイ":"株式会社ジャパンディスプレイ","ゼンリン":"株式会社ゼンリン","ソニー生命保険":"ソニー生命保険株式会社","トーエネック":"株式会社トーエネック","ニチイ学館":"株式会社ニチイ学館","パナソニック コネクト":"パナソニック コネクト株式会社","ファーマインド":"株式会社ファーマインド","ベネフィット・ワン":"株式会社ベネフィット・ワン","ホーチキ":"ホーチキ株式会社","ミロク情報サービス":"株式会社ミロク情報サービス","メットライフ生命":"メットライフ生命保険株式会社","ヤマトホールディングス":"ヤマトホールディングス株式会社","リクルート":"株式会社リクルート","ローム":"ローム株式会社","中部電力":"中部電力株式会社","京セラ":"京セラ株式会社","八千代エンジニヤリング":"八千代エンジニヤリング株式会社","共同印刷":"共同印刷株式会社","千葉銀行":"株式会社千葉銀行","博報堂":"株式会社博報堂","大和リース":"大和リース株式会社","大塚商会":"株式会社大塚商会","弥生":"弥生株式会社","日本総合研究所":"株式会社日本総合研究所","日産自動車":"日産自動車株式会社","日立情報通信エンジニアリング":"株式会社日立情報通信エンジニアリング","旭化成":"旭化成株式会社","東海理化":"株式会社東海理化","東芝デジタルソリューションズ":"東芝デジタルソリューションズ株式会社","積水ハウス":"積水ハウス株式会社","積水化学工業":"積水化学工業株式会社","荏原製作所":"株式会社荏原製作所","野村総合研究所":"株式会社野村総合研究所","阪急阪神ホールディングス":"阪急阪神ホールディングス株式会社","電通":"株式会社電通","高砂熱学工業":"高砂熱学工業株式会社","イトーキ":"株式会社イトーキ","エナリス":"株式会社エナリス","エフアンドエム":"株式会社エフアンドエム","エフテック":"株式会社エフテック","エレコム":"エレコム株式会社","セブン＆アイ・ホールディングス":"株式会社セブン＆アイ・ホールディングス","ベクトル":"株式会社ベクトル","前澤工業":"前澤工業株式会社","東京スター銀行":"株式会社東京スター銀行","池田泉州銀行":"株式会社池田泉州銀行","紀伊國屋書店":"株式会社紀伊國屋書店","FCE":"株式会社FCE","GR Japan":"GR Japan株式会社","OpenPolicy":"OpenPolicy株式会社","Spectee":"株式会社Spectee","エス・ピー・ネットワーク":"株式会社エス・ピー・ネットワーク","ジー・サーチ":"株式会社ジー・サーチ","セイノーロジックス":"セイノーロジックス株式会社","トーアミ":"株式会社トーアミ","フルノシステムズ":"株式会社フルノシステムズ","ライトアップ":"株式会社ライトアップ","リブドゥコーポレーション":"株式会社リブドゥコーポレーション","日本医療企画":"株式会社日本医療企画","時評社":"株式会社時評社","緑川化成工業":"緑川化成工業株式会社","若井ホールディングス":"若井ホールディングス株式会社","NTTデータグループ":"株式会社NTTデータグループ","パナソニック ホールディングス":"パナソニック ホールディングス株式会社","株式会社　NTTデータ経営研究所":"株式会社NTTデータ経営研究所","ENEOSホールディングス":"ENEOSホールディングス株式会社","IHI":"株式会社IHI","INPEX":"株式会社INPEX","JERA":"株式会社JERA","NEC":"日本電気株式会社","NIPPON EXPRESSホールディングス":"NIPPON EXPRESSホールディングス株式会社","NTTドコモ":"株式会社NTTドコモ","NTT西日本":"NTT西日本株式会社","Rapidus":"Rapidus株式会社","SCREENホールディングス":"株式会社SCREENホールディングス","UBE三菱セメント":"UBE三菱セメント株式会社","みずほフィナンシャルグループ":"株式会社みずほフィナンシャルグループ","みずほ銀行":"株式会社みずほ銀行","アドバンテスト":"株式会社アドバンテスト","インターネットイニシアティブ":"株式会社インターネットイニシアティブ","キオクシアホールディングス":"キオクシアホールディングス株式会社","ジェーシービー":"株式会社ジェーシービー","ジョンソン・エンド・ジョンソン":"ジョンソン・エンド・ジョンソン株式会社","ソニーグループ":"ソニーグループ株式会社","デンソー":"株式会社デンソー","トヨタ自動車":"トヨタ自動車株式会社","ファナック":"ファナック株式会社","フジクラ":"株式会社フジクラ","ルネサスエレクトロニクス":"ルネサス エレクトロニクス株式会社","レノバ":"株式会社レノバ","三井住友トラストグループ":"三井住友トラストグループ株式会社","三井住友フィナンシャルグループ":"株式会社三井住友フィナンシャルグループ","三井物産":"三井物産株式会社","三菱UFJフィナンシャル・グループ":"株式会社三菱UFJフィナンシャル・グループ","三菱商事":"三菱商事株式会社","三菱重工業":"三菱重工業株式会社","三菱電機":"三菱電機株式会社","中外製薬":"中外製薬株式会社","丸紅":"丸紅株式会社","伊藤忠商事":"伊藤忠商事株式会社","住友商事":"住友商事株式会社","住友金属鉱山":"住友金属鉱山株式会社","住友電気工業":"住友電気工業株式会社","信越化学工業":"信越化学工業株式会社","古河電気工業":"古河電気工業株式会社","大阪ガス":"大阪ガス株式会社","富士電機":"富士電機株式会社","日揮ホールディングス":"日揮ホールディングス株式会社","日本製鉄":"日本製鉄株式会社","本田技研工業":"本田技研工業株式会社","村田製作所":"株式会社村田製作所","東京エレクトロン":"東京エレクトロン株式会社","東京ガス":"東京ガス株式会社","東京海上ホールディングス":"東京海上ホールディングス株式会社","東京電力ホールディングス":"東京電力ホールディングス株式会社","武田薬品工業":"武田薬品工業株式会社","第一三共":"第一三共株式会社","AGC":"AGC株式会社","DOWAホールディングス":"DOWAホールディングス株式会社","HOYA":"HOYA株式会社","JFEホールディングス":"JFEホールディングス株式会社","KADOKAWA":"株式会社KADOKAWA","LINEヤフー":"LINEヤフー株式会社","MODEC":"三井海洋開発株式会社","MS&ADインシュアランスグループホールディングス":"ＭＳ＆ＡＤインシュアランスグループホールディングス株式会社","NTN":"NTN株式会社","NTTアーバンソリューションズ総合研究所":"株式会社NTTアーバンソリューションズ総合研究所","SCSK":"SCSK株式会社","SHIFT":"株式会社SHIFT","SMC":"SMC株式会社","SOMPOホールディングス":"ＳＯＭＰＯホールディングス株式会社","SUBARU":"株式会社SUBARU","SUMCO":"株式会社SUMCO","T&Dホールディングス":"株式会社T&Dホールディングス","TOPPANホールディングス":"TOPPANホールディングス株式会社","TOTO":"TOTO株式会社","UBE":"UBE株式会社","あおぞら銀行":"株式会社あおぞら銀行","いすゞ自動車":"いすゞ自動車株式会社","しずおかフィナンシャルグループ":"株式会社しずおかフィナンシャルグループ","ふくおかフィナンシャルグループ":"株式会社ふくおかフィナンシャルグループ","りそなホールディングス":"株式会社りそなホールディングス","アステラス製薬":"アステラス製薬株式会社","アマダ":"株式会社アマダ","アルプスアルパイン":"アルプスアルパイン株式会社","イビデン":"イビデン株式会社","エムスリー":"エムスリー株式会社","エーザイ":"エーザイ株式会社","オムロン":"オムロン株式会社","オリンパス":"オリンパス株式会社","オークマ":"オークマ株式会社","カナデビア":"カナデビア株式会社","カネカ":"株式会社カネカ","カメイ":"カメイ株式会社","キヤノン":"キヤノン株式会社","キユーピー":"キユーピー株式会社","キリンホールディングス":"キリンホールディングス株式会社","キーエンス":"株式会社キーエンス","クボタ":"株式会社クボタ","クラレ":"株式会社クラレ","クレディセゾン":"株式会社クレディセゾン","コマツ":"株式会社小松製作所","コムシスホールディングス":"コムシスホールディングス株式会社","ジェイテクト":"株式会社ジェイテクト","ジャパン マリンユナイテッド":"ジャパン マリンユナイテッド株式会社","スカパーJSATホールディングス":"スカパーJSAT株式会社","スズキ":"スズキ株式会社","セイコーエプソン":"セイコーエプソン株式会社","セコム":"セコム株式会社","ソシオネクスト":"株式会社ソシオネクスト","テルモ":"テルモ株式会社","ディスコ":"株式会社ディスコ","デンカ":"デンカ株式会社","トクヤマ":"株式会社トクヤマ","トレンドマイクロ":"トレンドマイクロ株式会社","ニコン":"株式会社ニコン","ニチレイ":"株式会社ニチレイ","ニッスイ":"株式会社ニッスイ","ブリヂストン":"株式会社ブリヂストン","ベネッセコーポレーション":"株式会社ベネッセコーポレーション","ボストンコンサルティンググループ":"ボストン・コンサルティング・グループ合同会社","マツダ":"マツダ株式会社","ミネベアミツミ":"ミネベアミツミ株式会社","メルカリ":"株式会社メルカリ","ヤマハ発動機":"ヤマハ発動機株式会社","リコー":"株式会社リコー","レゾナック・ホールディングス":"株式会社レゾナック・ホールディングス","レーザーテック":"レーザーテック株式会社","三井E&S":"株式会社三井E&S","三井化学":"三井化学株式会社","三井金属":"三井金属株式会社","三菱ケミカルグループ":"三菱ケミカルグループ株式会社","三菱マテリアル":"三菱マテリアル株式会社","三菱自動車工業":"三菱自動車工業株式会社","上組":"株式会社上組","五洋建設":"五洋建設株式会社","今治造船":"今治造船株式会社","住友ファーマ":"住友ファーマ株式会社","住友化学":"住友化学株式会社","住友重機械工業":"住友重機械工業株式会社","出光興産":"出光興産株式会社","協和キリン":"協和キリン株式会社","双日":"双日株式会社","名村造船所":"株式会社名村造船所","味の素":"味の素株式会社","商船三井":"株式会社商船三井","大和ハウス工業":"大和ハウス工業株式会社","大和証券グループ本社":"株式会社大和証券グループ本社","大塚ホールディングス":"大塚ホールディングス株式会社","大島造船所":"株式会社大島造船所","大成建設":"大成建設株式会社","大林組":"株式会社大林組","太平洋セメント":"太平洋セメント株式会社","太陽誘電":"太陽誘電株式会社","安川電機":"株式会社安川電機","富士フイルムホールディングス":"富士フイルムホールディングス株式会社","山九":"山九株式会社","島津製作所":"株式会社島津製作所","川崎汽船":"川崎汽船株式会社","帝人":"帝人株式会社","新明和工業":"新明和工業株式会社","新来島どっく":"株式会社新来島どっく","日本ガイシ":"NGK株式会社","日本取引所グループ":"株式会社日本取引所グループ","日本精工":"日本精工株式会社","日本航空":"日本航空株式会社","日本製鋼所":"株式会社日本製鋼所","日本郵政":"日本郵政株式会社","日本郵船":"日本郵船株式会社","日本電気硝子":"日本電気硝子株式会社","日東電工":"日東電工株式会社","日産化学":"日産化学株式会社","日立建機":"日立建機株式会社","明治ホールディングス":"明治ホールディングス株式会社","東ソー":"東ソー株式会社","東レ":"東レ株式会社","東洋エンジニアリング":"東洋エンジニアリング株式会社","東海カーボン":"東海カーボン株式会社","楽天グループ":"楽天グループ株式会社","横河電機":"横河電機株式会社","横浜ゴム":"横浜ゴム株式会社","横浜フィナンシャルグループ":"株式会社横浜フィナンシャルグループ","浜松ホトニクス":"浜松ホトニクス株式会社","清水建設":"清水建設株式会社","王子ホールディングス":"王子ホールディングス株式会社","神戸製鋼所":"株式会社神戸製鋼所","第一ライフグループ":"株式会社第一ライフグループ","船井総研ホールディングス":"株式会社船井総研ホールディングス","花王":"花王株式会社","豊田通商":"豊田通商株式会社","野村ホールディングス":"野村ホールディングス株式会社","長谷工コーポレーション":"株式会社長谷工コーポレーション","鹿島建設":"鹿島建設株式会社","アサヒグループホールディングス":"アサヒグループホールディングス株式会社","アフラック":"アフラック生命保険株式会社","イオン":"イオン株式会社","オリエンタルランド":"株式会社オリエンタルランド","カプコン":"株式会社カプコン","キッコーマン":"キッコーマン株式会社","コナミグループ":"コナミグループ株式会社","サイバーエージェント":"株式会社サイバーエージェント","ディー・エヌ・エー":"株式会社ディー・エヌ・エー","ニトリホールディングス":"株式会社ニトリホールディングス","ネクソン":"株式会社ネクソン","バンダイナムコホールディングス":"株式会社バンダイナムコホールディングス","パン・パシフィック・インターナショナルホールディングス":"株式会社パン・パシフィック・インターナショナルホールディングス","ファーストリテイリング":"株式会社ファーストリテイリング","ベイカレント":"株式会社ベイカレント","リクルートホールディングス":"株式会社リクルートホールディングス","三井不動産":"三井不動産株式会社","三菱地所":"三菱地所株式会社","三越伊勢丹ホールディングス":"株式会社三越伊勢丹ホールディングス","京成電鉄":"京成電鉄株式会社","京王電鉄":"京王電鉄株式会社","任天堂":"任天堂株式会社","住友不動産":"住友不動産株式会社","共同通信社":"一般社団法人共同通信社","小田急電鉄":"小田急電鉄株式会社","広済堂ホールディングス":"株式会社広済堂ホールディングス","日本たばこ産業":"日本たばこ産業株式会社","日本ハム":"日本ハム株式会社","日清製粉グループ本社":"株式会社日清製粉グループ本社","日邦産業":"日邦産業株式会社","東京建物":"東京建物株式会社","東宝":"東宝株式会社","東急":"東急株式会社","東急不動産ホールディングス":"東急不動産ホールディングス株式会社","東日本旅客鉄道":"東日本旅客鉄道株式会社","東武鉄道":"東武鉄道株式会社","東海旅客鉄道":"東海旅客鉄道株式会社","滋賀銀行":"株式会社滋賀銀行","良品計画":"株式会社良品計画","西日本旅客鉄道":"西日本旅客鉄道株式会社","資生堂":"株式会社資生堂","電通グループ":"株式会社電通グループ","九州経済研究所":"株式会社九州経済研究所","MS&ADインシュアランスグループホールディングス株式会社":"ＭＳ＆ＡＤインシュアランスグループホールディングス株式会社","SOMPOホールディングス株式会社":"ＳＯＭＰＯホールディングス株式会社","T&Dホールディングス株式会社":"株式会社T&Dホールディングス","ボストン コンサルティング グループ合同会社":"ボストン・コンサルティング・グループ合同会社"};
let PROGRESS_CACHE = {};
let PROGRESS_DB = null;
let STORAGE_PERSISTED = false;
let noteSaveTimer = null;

function esc(s){ return (s??"").toString().trim(); }
function honorific(s){ return s ? s.replace(/様$/,"")+"様" : "御社"; }
function companyByName(name){ return COMPANY_DATA.find(c=>c.company===name) || null; }
function companyTags(c){
  if(!c) return [];
  if(Array.isArray(c.search_tags) && c.search_tags.length) return c.search_tags;
  return c.industry ? [c.industry] : ["その他・複合"];
}
function companyHasTag(c,tag){ return !!tag && companyTags(c).includes(tag); }

let APP_MODE = "single";

function init(){
  if(!Array.isArray(window.COMPANY_DATA) || !window.COMPANY_DATA.length){
    throw new Error("企業マスタが未読込です。Firebase接続と読み込み状態を確認してください。");
  }
  renderCompanyDropdown();
  renderDirectCompanyControls();
  $("showApproachedCompanies").addEventListener("change", ()=>{
    renderCompanyDropdown();
    renderDirectCompanyControls();
  });
  $("companySearchText").addEventListener("input", renderDirectCompanyControls);
  $("companySearchResults").addEventListener("change", ()=>{
    if($("companySearchResults").value) selectCompanyDirect($("companySearchResults").value);
  });
  $("companyAllSelect").addEventListener("change", ()=>{
    if($("companyAllSelect").value) selectCompanyDirect($("companyAllSelect").value);
  });
  $("singleModeBtn").addEventListener("click",()=>setAppMode("single"));
  $("bulkModeBtn").addEventListener("click",()=>setAppMode("bulk"));
  $("progressModeBtn").addEventListener("click",()=>setAppMode("progress"));
  $("adminModeBtn").addEventListener("click",()=>setAppMode("admin"));
  $("industry").innerHTML = `<option value="">業種／戦略分野を選択</option>` + Object.keys(INDUSTRY_DEFAULTS).map(x=>`<option value="${xmlEscape(x)}">${xmlEscape(x)}</option>`).join("");
  $("companyInput").addEventListener("change", applyCompany);
  $("legacyConnection").addEventListener("change",generate);
    $("industry").addEventListener("change", applyIndustry);
  $("generateBtn").addEventListener("click", generate);
  $("clearCompanyBtn").addEventListener("click", clearCompanySelection);
  $("resetBtn").addEventListener("click", resetForm);
  $("downloadTxtBtn").addEventListener("click", downloadAll);
  $("downloadDocxBtn").addEventListener("click", downloadDocx);
  $("printPdfBtn").addEventListener("click", printPdf);
  $("exportSelectedCsvBtn").addEventListener("click", exportSelectedCsv);
  $("exportAllCsvBtn").addEventListener("click", exportAllCsv);
  $("exportAllJsonBtn").addEventListener("click", exportAllJson);
  $("applyBulkFilterBtn").addEventListener("click", renderBulkCompanies);
  ["industryFilters","usageFilters"].forEach(id=>$(id).addEventListener("change", renderBulkCompanies));
  $("excludeApproachedBulk").addEventListener("change", renderBulkCompanies);
  $("selectVisibleBtn").addEventListener("click", selectVisibleCompanies);
  $("clearBulkSelectionBtn").addEventListener("click", clearBulkSelection);
  $("clearBulkFiltersBtn").addEventListener("click", clearBulkFilters);
  $("bulkGenerateBtn").addEventListener("click", generateBulkDocuments);
  $("bulkDocxBtn").addEventListener("click", downloadBatchDocx);
  $("bulkPdfBtn").addEventListener("click", printBatchPdf);
  $("exportBulkSelectedCompaniesBtn").addEventListener("click", exportBulkSelectedCompaniesCsv);
  $("bulkCsvBtn").addEventListener("click", exportBatchCsv);
  $("stampBulkApproachBtn").addEventListener("click", stampBulkApproachToday);
  $("saveProgressBtn").addEventListener("click", saveProgressFromForm);
  $("clearProgressBtn").addEventListener("click", clearCurrentProgress);
  document.querySelectorAll(".stamp-today").forEach(btn=>btn.addEventListener("click",()=>stampToday(btn.dataset.field)));
  $("progressViewFilter").addEventListener("change", renderProgressList);
  $("progressSearch").addEventListener("input", renderProgressList);
  $("refreshProgressBtn").addEventListener("click", renderProgressList);
  $("exportVisibleProgressBtn").addEventListener("click",()=>exportProgressCsv(filteredProgressRows(),"政策リサーチ_営業進捗_表示中.csv"));
  $("exportApproachedBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.progress.approach_date),"政策リサーチ_アプローチ済み一覧.csv"));
  $("exportCurrentUsersBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.usage==="現在利用中"),"政策リサーチ_現在利用中企業一覧.csv"));
  $("exportWithdrawnBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.usage==="利用後退会"),"政策リサーチ_利用後退会企業一覧.csv"));
  $("exportIncompleteBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.auto.incomplete),"政策リサーチ_未了一覧.csv"));
  $("exportProgressJsonBtn").addEventListener("click", exportProgressJson);
  $("importProgressJsonBtn").addEventListener("click",()=>$("importProgressJsonFile").click());
  $("importProgressJsonFile").addEventListener("change", importProgressJson);
  ["progressApproachDate","progressReplyDate","progressMeetingDate","progressAppliedDate","progressRejectedDate"].forEach(id=>{
    $(id).addEventListener("change",()=>{ if(companyByName($("companyInput").value)) saveProgressFromForm(true); });
  });
  $("progressNote").addEventListener("input",()=>{
    clearTimeout(noteSaveTimer);
    noteSaveTimer=setTimeout(()=>{ if(companyByName($("companyInput").value)) saveProgressFromForm(true); },500);
  });
  initPersistentStorage();
  renderBulkFilters();
  applyIndustry(); generate();
  setAppMode("single");
}



function setAppMode(mode){
  if(!["single","bulk","progress","admin"].includes(mode)) mode="single";
  APP_MODE=mode;
  const single=mode==="single", bulk=mode==="bulk", progress=mode==="progress", admin=mode==="admin";
  $("singleModeArea").style.display=single?"block":"none";
  $("bulkModeArea").style.display=bulk?"block":"none";
  $("progressModeArea").style.display=progress?"block":"none";
  $("companyAdminPanel").hidden=!admin;
  $("adminModeBtn").setAttribute("aria-expanded",String(admin));

  [["singleModeBtn",single],["bulkModeBtn",bulk],["progressModeBtn",progress],["adminModeBtn",admin]].forEach(([id,on])=>{
    $(id).classList.toggle("active",on);
    $(id).classList.toggle("secondary",!on);
    $(id).setAttribute("aria-pressed",String(on));
  });

  $("modeDescription").textContent=single
    ? "1社モード：企業マスタから選んだ1社だけの企業情報・営業進捗・文面を表示します。"
    : bulk
    ? "複数企業モード：成長戦略17分野・利用状況で絞り込み、複数社の文面作成とアプローチ日一括記録ができます。"
    : progress
    ? "営業進捗一覧：アプローチ済み、現在利用中、利用後退会、未了、オンライン会議、申込完了、拒否を一覧表示・出力します。"
    : "企業マスタ管理：個別登録・修正・削除とExcel・CSV・JSONの一括取込。管理者権限が必要です。";

  if(single){
    $("bulkOutput").value="";
    renderCompanyDropdown();
    renderDirectCompanyControls();
  }else if(bulk){
    renderBulkCompanies();
  }else if(progress){
    renderProgressList();
  }
  window.scrollTo({top:0,behavior:"smooth"});
}

function loadProgressStore(){
  return PROGRESS_CACHE||{};
}
function saveProgressStore(store){
  PROGRESS_CACHE=store||{};
}
function updateStorageStatus(message,type="ok"){
  const el=$("storageStatusText");
  if(!el) return;
  el.textContent=message;
  el.classList.remove("storage-ok","storage-warn","storage-error");
  el.classList.add(type==="error"?"storage-error":type==="warn"?"storage-warn":"storage-ok");
}
function openProgressDB(){
  return new Promise((resolve,reject)=>{
    if(PROGRESS_DB){ resolve(PROGRESS_DB); return; }
    if(!("indexedDB" in window)){ reject(new Error("IndexedDB unsupported")); return; }
    const req=indexedDB.open(PROGRESS_DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(PROGRESS_DB_STORE)) db.createObjectStore(PROGRESS_DB_STORE);
    };
    req.onsuccess=()=>{ PROGRESS_DB=req.result; resolve(PROGRESS_DB); };
    req.onerror=()=>reject(req.error||new Error("IndexedDB open failed"));
  });
}
async function idbPutProgress(store){
  try{
    const db=await openProgressDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROGRESS_DB_STORE,"readwrite");
      tx.objectStore(PROGRESS_DB_STORE).put(store,"progress");
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    updateStorageStatus(STORAGE_PERSISTED?"端末に永続保存済み":"端末に保存済み");
  }catch(e){
    updateStorageStatus("localStorageには保存済み（IndexedDBは利用不可）","warn");
  }
}
async function idbGetProgress(){
  const db=await openProgressDB();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(PROGRESS_DB_STORE,"readonly");
    const req=tx.objectStore(PROGRESS_DB_STORE).get("progress");
    req.onsuccess=()=>resolve(req.result||{});
    req.onerror=()=>reject(req.error);
  });
}
function mergeProgressStores(a,b){
  const out={...(a||{})};
  Object.entries(b||{}).forEach(([company,rec])=>{
    const old=out[company];
    if(!old){out[company]=rec;return;}
    const ot=Date.parse(old.updated_at||"1970-01-01")||0;
    const nt=Date.parse(rec.updated_at||"1970-01-01")||0;
    out[company]=nt>=ot?{...old,...rec}:{...rec,...old};
  });
  return out;
}
function migrateProgressCompanyNames(store){
  const out={...(store||{})};
  Object.entries(COMPANY_RENAME_MAP||{}).forEach(([oldName,newName])=>{
    if(!oldName||!newName||oldName===newName||!out[oldName]) return;
    if(!out[newName]) out[newName]=out[oldName];
    else out[newName]=mergeProgressStores({[newName]:out[newName]},{[newName]:out[oldName]})[newName];
    delete out[oldName];
  });
  return out;
}
async function initPersistentStorage(){
  updateStorageStatus("Firebaseで同期中…", "warn");
}
function applyCloudProgressStore(store){
  PROGRESS_CACHE=migrateProgressCompanyNames(store||{});
  updateStorageStatus("Firebaseに同期済み（端末間共有）", "ok");
  renderCompanyDropdown();renderDirectCompanyControls();
  if(APP_MODE==="progress") renderProgressList();
  const c=companyByName($("companyInput").value);
  // Do not overwrite user's unsaved typing while editing; onSnapshot is not used to overwrite form.
  if(c && document.activeElement?.id!=="progressNote") loadProgressIntoForm(c.company);
}
window.applyCloudProgressStore=applyCloudProgressStore;

function applyCloudCompanyStore(records){
  if(!Array.isArray(records)) return;
  const currentCompany=$("companyInput")?.value||"";
  const selectedIndustry=$("industry")?.value||"";
  COMPANY_DATA.splice(0,COMPANY_DATA.length,...records);
  COMPANY_DATA.forEach(c=>{
    [c.industry,...(Array.isArray(c.search_tags)?c.search_tags:[])].forEach(name=>{
      if(typeof name!=="string" || !name.trim() || INDUSTRY_DEFAULTS[name])return;
      INDUSTRY_DEFAULTS[name]={
        dept:c.dept1||"経営企画・政策渉外等",
        theme:c.sales_theme||name,
        demo:c.demo||"御社に関連する政府資料を2～3件確認"
      };
    });
  });
  const selected=$("industry");
  selected.innerHTML='<option value="">業種／戦略分野を選択</option>'+Object.keys(INDUSTRY_DEFAULTS).map(x=>'<option value="'+xmlEscape(x)+'">'+xmlEscape(x)+'</option>').join("");
  selected.value=selectedIndustry;
  renderBulkFilters();
  renderCompanyDropdown();
  renderDirectCompanyControls();
  if(currentCompany && COMPANY_DATA.some(c=>c.company===currentCompany)){
    // Refresh the company side panel, but do not overwrite active sales-talk editing fields.
    const preset=companyByName(currentCompany);
    if(APP_MODE==="single") renderSelectedCompanySidePanel({company:currentCompany,preset});
  }
  if(APP_MODE==="bulk") renderBulkCompanies();
  if(APP_MODE==="progress") renderProgressList();
  window.refreshCompanyAdmin?.();
}
window.applyCloudCompanyStore=applyCloudCompanyStore;

function getProgress(company){
  const store=loadProgressStore();
  return store[company]||{approach_date:"",reply_date:"",meeting_date:"",applied_date:"",rejected_date:"",note:"",updated_at:""};
}
function setProgress(company,data){
  if(!company) return;
  const before=getProgress(company);
  const record={...before,...data,updated_at:new Date().toISOString()};
  PROGRESS_CACHE[company]=record;
  if(window.salesCloud) window.salesCloud.save(company,record).catch(e=>updateStorageStatus("Firebase保存失敗: "+e.message,"error"));
  else updateStorageStatus("Firebaseに接続されていません","error");
}
function deleteProgress(company){
  delete PROGRESS_CACHE[company];
  if(window.salesCloud) window.salesCloud.remove(company).catch(e=>updateStorageStatus("Firebase削除失敗: "+e.message,"error"));
}
function todayISO(){
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function dateToLocal(s){
  if(!s) return null;
  const p=s.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]);
}
function daysSince(s){
  const d=dateToLocal(s); if(!d) return "";
  const t=dateToLocal(todayISO()); return Math.floor((t-d)/86400000);
}
function progressAuto(company){
  const p=getProgress(company);
  let status="未アプローチ";
  if(p.applied_date) status="申込完了";
  else if(p.rejected_date) status="拒否";
  else if(p.meeting_date){
    const md=dateToLocal(p.meeting_date), td=dateToLocal(todayISO());
    status=md&&md>td?"オンライン会議予定":"オンライン会議済";
  }else if(p.reply_date) status="返信あり";
  else if(p.approach_date) status="アプローチ済み（返信待ち）";

  let incomplete="";
  const elapsed=daysSince(p.approach_date);
  if(p.approach_date && !p.reply_date && !p.meeting_date && !p.applied_date && !p.rejected_date){
    if(elapsed>=30) incomplete="未了（1ヶ月）";
    else if(elapsed>=14) incomplete="未了（2週間）";
  }
  return {status,incomplete,elapsed:elapsed===""?"":elapsed};
}
function stampToday(fieldId){
  if(!companyByName($("companyInput").value)){alert("企業マスタから企業を選択してください。");return;}
  $(fieldId).value=todayISO(); saveProgressFromForm();
}
function loadProgressIntoForm(company){
  const p=getProgress(company);
  $("progressApproachDate").value=p.approach_date||"";
  $("progressReplyDate").value=p.reply_date||"";
  $("progressMeetingDate").value=p.meeting_date||"";
  $("progressAppliedDate").value=p.applied_date||"";
  $("progressRejectedDate").value=p.rejected_date||"";
  $("progressNote").value=p.note||"";
  renderCurrentProgressStatus();
}
function saveProgressFromForm(silent=false){
  const c=companyByName($("companyInput").value);
  if(!c){alert("進捗を保存するには企業マスタから企業を選択してください。");return;}
  const data={
    approach_date:$("progressApproachDate").value,
    reply_date:$("progressReplyDate").value,
    meeting_date:$("progressMeetingDate").value,
    applied_date:$("progressAppliedDate").value,
    rejected_date:$("progressRejectedDate").value,
    note:$("progressNote").value||""
  };
  if(data.applied_date) data.rejected_date="";
  else if(data.rejected_date) data.applied_date="";
  setProgress(c.company,data);
  $("progressAppliedDate").value=data.applied_date;
  $("progressRejectedDate").value=data.rejected_date;
  renderCurrentProgressStatus();
  renderCompanyDropdown();
  renderDirectCompanyControls();
  render(c);
  if(!silent) updateStorageStatus("Firebaseに保存処理中…", "warn");
}
function clearCurrentProgress(){
  const c=companyByName($("companyInput").value);
  if(!c){alert("企業マスタから企業を選択してください。");return;}
  if(!confirm(`${c.company} の営業進捗記録をクリアしますか？`)) return;
  deleteProgress(c.company); loadProgressIntoForm(c.company); renderCompanyDropdown(); renderDirectCompanyControls(); render(c);
}
function renderCurrentProgressStatus(){
  const c=companyByName($("companyInput").value);
  if(!c){$("progressStatusText").textContent="未記録";$("progressIncompleteText").textContent="—";return;}
  const a=progressAuto(c.company);
  $("progressStatusText").textContent=a.status;
  $("progressIncompleteText").textContent=a.incomplete||"—";
}
function stampBulkApproachToday(){
  if(APP_MODE!=="bulk") return;
  if(!BULK_SELECTED.size){alert("対象企業を1社以上選択してください。");return;}
  const today=todayISO();
  BULK_SELECTED.forEach(name=>setProgress(name,{approach_date:today}));
  alert(`${BULK_SELECTED.size}社に初回アプローチ日 ${today} を記録しました。`);
  renderCompanyDropdown();
  renderDirectCompanyControls();
  renderBulkCompanies();
}
function progressRows(){
  return COMPANY_DATA.map(c=>{
    const p=getProgress(c.company), auto=progressAuto(c.company);
    return {company:c.company,rank:c.priority_rank||"B",industry:companyTags(c).join("・"),usage:usageStatus(c),contact:c.contact||"",progress:p,auto};
  });
}
function filteredProgressRows(){
  const mode=$("progressViewFilter").value, q=($("progressSearch").value||"").trim().toLowerCase();
  return progressRows().filter(r=>{
    if(q && !r.company.toLowerCase().includes(q)) return false;
    if(mode==="approached") return !!r.progress.approach_date;
    if(mode==="current") return r.usage==="現在利用中";
    if(mode==="withdrawn") return r.usage==="利用後退会";
    if(mode==="incomplete") return !!r.auto.incomplete;
    if(mode==="incomplete14") return r.auto.incomplete==="未了（2週間）";
    if(mode==="incomplete30") return r.auto.incomplete==="未了（1ヶ月）";
    if(mode==="meeting") return !!r.progress.meeting_date;
    if(mode==="applied") return !!r.progress.applied_date;
    if(mode==="rejected") return !!r.progress.rejected_date;
    return true;
  });
}
function renderProgressList(){
  if(APP_MODE!=="progress") return;
  const all=progressRows(), rows=filteredProgressRows();
  $("kpiApproached").textContent=all.filter(r=>r.progress.approach_date).length;
  $("kpiCurrent").textContent=all.filter(r=>r.usage==="現在利用中").length;
  $("kpiWithdrawn").textContent=all.filter(r=>r.usage==="利用後退会").length;
  $("kpiIncomplete14").textContent=all.filter(r=>r.auto.incomplete==="未了（2週間）").length;
  $("kpiIncomplete30").textContent=all.filter(r=>r.auto.incomplete==="未了（1ヶ月）").length;
  $("kpiApplied").textContent=all.filter(r=>r.progress.applied_date).length;
  $("kpiRejected").textContent=all.filter(r=>r.progress.rejected_date).length;
  $("progressVisibleCount").textContent=rows.length;
  $("progressTableBody").innerHTML=rows.map(r=>{
    const cls=r.auto.incomplete==="未了（1ヶ月）"?"incomplete30":r.auto.incomplete==="未了（2週間）"?"incomplete14":r.progress.applied_date?"applied":r.progress.rejected_date?"rejected":"";
    return `<tr class="${cls}">
      <td title="${xmlEscape(r.rank)}">${xmlEscape(r.rank)}</td>
      <td title="${xmlEscape(r.company)}">${xmlEscape(r.company)}</td>
      <td title="${xmlEscape(r.industry)}">${xmlEscape(r.industry)}</td>
      <td title="${xmlEscape(r.usage)}">${xmlEscape(r.usage)}</td>
      <td>${r.progress.approach_date||""}</td><td>${r.progress.reply_date||""}</td><td>${r.progress.meeting_date||""}</td>
      <td>${r.progress.applied_date||""}</td><td>${r.progress.rejected_date||""}</td>
      <td title="${xmlEscape(r.progress.note||"")}">${xmlEscape(r.progress.note||"")}</td>
      <td title="${xmlEscape(r.auto.status)}">${xmlEscape(r.auto.status)}</td><td title="${xmlEscape(r.auto.incomplete||"")}">${xmlEscape(r.auto.incomplete||"")}</td><td>${r.auto.elapsed}</td>
    </tr>`;
  }).join("");
}
function progressCsvRows(rows){
  const header=["優先ランク","企業名","主業種・戦略分野","利用状況","公開連絡先","初回アプローチ日","最終返信日","オンライン会議日","申込完了日","拒否日","営業メモ・履歴","営業進捗","未了判定","経過日数"];
  const vals=rows.map(r=>[r.rank,r.company,r.industry,r.usage,r.contact,r.progress.approach_date,r.progress.reply_date,r.progress.meeting_date,r.progress.applied_date,r.progress.rejected_date,r.progress.note||"",r.auto.status,r.auto.incomplete,r.auto.elapsed]);
  return [header,...vals];
}
function exportProgressCsv(rows,filename){
  const csv="\ufeff"+progressCsvRows(rows).map(r=>r.map(csvEscape).join(",")).join("\r\n");
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),filename);
}
function exportProgressJson(){
  const payload={exported_at:new Date().toISOString(),progress:loadProgressStore()};
  saveBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}),"政策リサーチ_営業進捗バックアップ.json");
}
async function importProgressJson(ev){
  const file=ev.target.files && ev.target.files[0];
  if(!file) return;
  try{
    const text=await file.text();
    const obj=JSON.parse(text);
    const incoming=(obj && obj.progress) ? obj.progress : obj;
    if(!incoming || typeof incoming!=="object" || Array.isArray(incoming)) throw new Error("形式が不正です");
    PROGRESS_CACHE=mergeProgressStores(PROGRESS_CACHE,incoming);
    saveProgressStore(PROGRESS_CACHE);
    renderCompanyDropdown();
    renderDirectCompanyControls();
    if(APP_MODE==="progress") renderProgressList();
    const selected=companyByName($("companyInput").value);
    if(selected) loadProgressIntoForm(selected.company);
    updateStorageStatus("バックアップを復元し、端末に保存しました");
    alert("営業進捗バックアップを復元しました。");
  }catch(e){
    alert("JSONバックアップを復元できませんでした。ファイル内容をご確認ください。");
  }finally{
    ev.target.value="";
  }
}

function usageStatus(c){
  if(c.sales_group==="現在利用") return "現在利用中";
  if(c.sales_group==="過去有料利用") return "利用後退会";
  if(c.sales_group==="トライアルのみ") return "トライアルのみ";
  if(c.sales_group==="完全新規") return "完全新規";
  return "その他";
}
function selectedValues(containerId){
  return [...document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)].map(x=>x.value);
}
// 大分類は複数企業モード専用。企業マスタの細分類や検索タグは変更しない。
// 日本成長戦略（2026年7月21日閣議決定）本文の掲載順で17戦略分野を表示。
// 企業マスタの詳細分類は変更せず、企業ごとの既存タグ・テーマから複数該当を判定する。
// 官民投資ロードマップとの対応用。業種コードのような相互排他的分類ではない。
const BULK_SECTOR_GROUPS = [
  {name:"AI・半導体",pattern:/AI(?!S)|人工知能|機械学習|深層学習|生成AI|フィジカルAI|半導体|半導体製造|半導体装置|チップ|GPU|HPC|先端ロジック|メモリ半導体/iu},
  {name:"デジタル・サイバーセキュリティ",pattern:/デジタル|DX|ソフトウェア|クラウド|データセンター|サイバー|セキュリティ|情報システム|ITサービス|ICTサービス|ゼロトラスト|暗号|SaaS|データ基盤|ITインフラ/iu},
  {name:"情報通信",pattern:/情報通信|電気通信|通信網|通信設備|通信機器|無線|光通信|光ファイバ|ネットワーク|5G|6G|基地局|通信衛星|ブロードバンド|次世代通信|通信インフラ/iu},
  {name:"量子",pattern:/量子|量子計算|量子コンピュータ|量子暗号|量子通信|量子センシング/iu},
  {name:"防衛産業",pattern:/防衛|防衛装備|軍事|安全保障装備|ミサイル|レーダー|艦艇|戦闘機|防衛機器|軍民両用|デュアルユース/iu},
  {name:"航空・宇宙",pattern:/航空機|航空宇宙|宇宙|衛星|ロケット|宇宙輸送|航空エンジン|機体製造|ドローン|無人航空機|空飛ぶクルマ/iu},
  {name:"海洋",pattern:/海洋|海底|海域|海洋資源|海洋開発|海洋調査|深海|海底ケーブル|海洋エネルギー|海洋観測|洋上プラットフォーム/iu},
  {name:"造船",pattern:/造船|船舶建造|船舶修繕|船舶エンジン|船舶用機器|海事産業|船舶設計/iu},
  {name:"マテリアル（重要鉱物・部素材）",pattern:/マテリアル|重要鉱物|レアアース|レアメタル|部素材|素材|材料|化学品|化学素材|非鉄|鉄鋼|金属|合金|樹脂|炭素繊維|セラミック|機能性材料|半導体材料|磁石|電池材料/iu},
  {name:"合成生物学・バイオ",pattern:/合成生物|バイオ|バイオものづくり|発酵|ゲノム|遺伝子|細胞培養|微生物|バイオ製造|バイオマス/iu},
  {name:"創薬・先端医療",pattern:/創薬|医薬|製薬|医療|ヘルスケア|再生医療|先端医療|治療|臨床|医療機器|診断|医薬品|抗体|細胞治療/iu},
  {name:"資源・エネルギー安全保障・GX",pattern:/資源|エネルギー|GX|脱炭素|カーボン|石油|天然ガス|電力|再エネ|再生可能|洋上風力|水素|蓄電|CCUS|省エネ|LNG|地熱|燃料/iu},
  {name:"フュージョンエネルギー",pattern:/フュージョン|核融合|核融合炉|プラズマ加熱|トカマク/iu},
  {name:"防災・国土強靱化",pattern:/防災|国土強靱|国土強靭|減災|防洪|治水|耐震|インフラ老朽化|災害|復旧|洪水|地震|レジリエンス|社会インフラ|インフラ維持|老朽インフラ/iu},
  {name:"港湾ロジスティクス",pattern:/港湾|港運|港湾物流|港湾荷役|物流|ロジスティクス|海運物流|コンテナ|倉庫|物流拠点|港湾設備|自動搬送|サプライチェーン輸送/iu},
  {name:"フードテック",pattern:/フードテック|食品|食料|食農|農業|農産|植物工場|スマート農業|アグリテック|食品加工|食品製造|代替タンパク|水産養殖|水産加工|畜産|培養肉/iu},
  {name:"コンテンツ",pattern:/コンテンツ|ゲーム|アニメ|漫画|マンガ|映画|映像制作|音楽制作|出版|IPビジネス|エンターテインメント|クリエイティブ|放送|メディア/iu}
];
// 詳細業種および精査済みの政策キーワードを材料にする。
// 一般的な会社名だけでは分類しない。曖昧なケースは無理に17分野へ割り振らない。
function bulkCompanySectorNames(c){
  const tags=Array.isArray(c.search_tags)?c.search_tags:[];
  const text=[c.industry, ...tags, c.sales_theme, c.secondary, c.policy_trigger].filter(v=>typeof v==="string").join("・");
  return BULK_SECTOR_GROUPS.filter(g=>g.pattern.test(text)).map(g=>g.name);
}
function renderBulkFilters(){
  const selected=new Set(selectedValues("industryFilters"));
  $("industryFilters").innerHTML=BULK_SECTOR_GROUPS.map(g=>{
    const count=COMPANY_DATA.filter(c=>bulkCompanySectorNames(c).includes(g.name)).length;
    return '<label><input type="checkbox" value="'+xmlEscape(g.name)+'" '+(selected.has(g.name)?"checked":"")+'> '+xmlEscape(g.name)+' <span class="bulk-filter-count">('+count+')</span></label>';
  }).join("");
  const selectedStatus=new Set(selectedValues("usageFilters"));
  const statuses=["現在利用中","利用後退会","トライアルのみ","完全新規","その他"];
  $("usageFilters").innerHTML=statuses.map(x=>{
    const count=COMPANY_DATA.filter(c=>usageStatus(c)===x).length;
    return '<label><input type="checkbox" value="'+x+'" '+(selectedStatus.has(x)?"checked":"")+'> '+x+' <span class="bulk-filter-count">('+count+')</span></label>';
  }).join("");
  // Change listeners are registered once in init() to avoid duplicates after master refresh.
}
function filteredBulkCompanies(){
  const inds=selectedValues("industryFilters"),sts=selectedValues("usageFilters");
  const excludeApproached=$("excludeApproachedBulk")?.checked===true;
  // 未選択は「全業種」「全利用状況」。どちらかだけ選んでも絞り込める。
  return COMPANY_DATA.filter(c=>{
    const indOk=!inds.length || inds.some(ind=>bulkCompanySectorNames(c).includes(ind));
    const stOk=!sts.length || sts.includes(usageStatus(c));
    const approachOk=!excludeApproached || !getProgress(c.company).approach_date;
    return indOk && stOk && approachOk;
  }).sort(compareCompanyPriorityName);
}
function renderBulkCompanies(){
  if(APP_MODE!=="bulk") return;
  const list=filteredBulkCompanies();
  $("visibleCompanyCount").textContent=list.length;
  if(!list.length){
    $("bulkCompanyList").innerHTML='<div class="help" style="padding:12px">該当する企業がありません。条件または「アプローチ済み企業を除外」を確認してください。</div>';
    $("selectedCompanyCount").textContent=BULK_SELECTED.size;
    return;
  }
  $("bulkCompanyList").innerHTML=list.map(c=>{
    const checked=BULK_SELECTED.has(c.company)?"checked":"";
    const contact=c.contact||"連絡先未確認";
    const sector=bulkCompanySectorNames(c).join("・");
    const p=getProgress(c.company);
    const approachMark=p.approach_date ? ` ／ アプローチ済 ${p.approach_date}` : "";
    return `<label class="company-check-item">
      <input class="bulk-company-check" type="checkbox" value="${xmlEscape(c.company)}" ${checked}>
      <span><strong>[${xmlEscape(c.priority_rank||"B")}] ${xmlEscape(c.company)}</strong>
      <div class="meta">${xmlEscape(sector)} ／ ${xmlEscape(usageStatus(c))} ／ ${xmlEscape(contact)}${xmlEscape(approachMark)}</div></span>
    </label>`;
  }).join("");
  document.querySelectorAll(".bulk-company-check").forEach(el=>el.addEventListener("change",()=>{
    if(el.checked) BULK_SELECTED.add(el.value); else BULK_SELECTED.delete(el.value);
    $("selectedCompanyCount").textContent=BULK_SELECTED.size;
  }));
  $("selectedCompanyCount").textContent=BULK_SELECTED.size;
}
function selectVisibleCompanies(){
  if(APP_MODE!=="bulk") return;
  filteredBulkCompanies().forEach(c=>BULK_SELECTED.add(c.company));
  renderBulkCompanies();
}
function clearBulkSelection(){
  if(APP_MODE!=="bulk") return;
  BULK_SELECTED.clear(); renderBulkCompanies(); $("bulkOutput").value=""; LAST_BATCH_DOCS=[];
}
function clearBulkFilters(){
  if(APP_MODE!=="bulk") return;
  document.querySelectorAll("#industryFilters input,#usageFilters input").forEach(x=>x.checked=false);
  BULK_SELECTED.clear(); LAST_BATCH_DOCS=[]; $("bulkOutput").value="";
  renderBulkCompanies();
}
function batchOpening(c){
  const st=usageStatus(c);
  if(st==="現在利用中") return "いつも政策リサーチをご利用いただき、ありがとうございます。";
  if(st==="利用後退会") return "以前、政策リサーチをご利用いただき、ありがとうございました。";
  if(st==="トライアルのみ") return "以前、政策リサーチをお試しいただき、ありがとうございました。";
  return "突然のご連絡失礼いたします。一般社団法人日本みらい研の髙松と申します。";
}
function batchSubject(c,stage,theme){
  const st=usageStatus(c);
  if(stage==="利用者"){
    if(st==="現在利用中") return `【政策リサーチ】ご利用状況と「${theme}」の最新政策について`;
    if(st==="利用後退会") return `【政策リサーチ】以前のご利用御礼と「${theme}」の最新動向`;
    if(st==="トライアルのみ") return `【政策リサーチ】以前のトライアル御礼と「${theme}」の最新動向`;
  }
  if(stage==="電話後メール") return `【先ほどのお電話の件】${c.company}様の「${theme}」に関する政策資料`;
  if(stage==="15分商談") return `【政策リサーチ】${c.company}様向け15分デモのご案内`;
  if(stage==="10日間トライアル") return `【政策リサーチ】10日間無料トライアルのご案内`;
  return `【政策リサーチ】${c.company}様に関係する「${theme}」の政策情報`;
}
function batchBody(c,stage,theme,note){
  const st=usageStatus(c), trigger=c.policy_trigger||"直近の政府会議・予算・制度動向";
  const dept=c.dept1||"政策渉外・経営企画等のご担当部門";
  const demo=c.demo||"関連する政府会議・予算・制度資料を横断してご説明";
  if(stage==="利用者"){
    if(st==="現在利用中"){
      return `${batchOpening(c)}

現在、御社では政策リサーチをご利用いただいておりますが、最近の「${theme}」に関する政策動向も踏まえ、より活用いただける余地があるのではと思いご連絡しました。

直近では「${trigger}」も動いています。検索だけでなく、当日解説、週2回の政策レポート、アラート等を組み合わせることで、情報収集から社内共有まで効率化できます。

15分ほど、現在のご利用状況を伺いながら、①利用促進、②関連テーマの追加、③他部署での活用、のいずれが有効か整理してご案内できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
    }
    if(st==="利用後退会"){
      return `${batchOpening(c)}

その後、政策リサーチは当日解説、AI解析、週2回の政策レポート等を拡充しています。また、御社に関係する「${theme}」でも新しい政策動向が続いています。

直近の「${trigger}」を含め、現在のサービスでどのように把握できるか、15分程度で改めてご説明できます。以前ご利用いただいた時点との違いも含めてご覧いただければと思います。${note?`\n\n${note}`:""}

${SIGNATURE}`;
    }
    if(st==="トライアルのみ"){
      return `${batchOpening(c)}

現在は、当日解説、AI解析、政策レポートなどを拡充しており、以前お試しいただいた時点からサービス内容も進化しています。

特に「${theme}」では「${trigger}」など新しい動きがあり、御社に関係する資料を使って15分程度で現在の活用方法をご説明できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
    }
    return `【注意】${c.company}は完全新規のため、「利用者」接触段階は通常適しません。\n\n${batchOpening(c)}\n\n「${theme}」に関係する政策動向について、${dept}のご担当者様へご案内したくご連絡しました。\n\n${SIGNATURE}`;
  }
  if(stage==="初回電話"){
    return `【代表受付・ファーストコンタクト】
突然のお電話で失礼いたします。一般社団法人日本みらい研の髙松と申します。
御社の「${theme}」との関係が深いことから、政府関連情報の有効な活用方法についてお話しいたしたくご連絡しました。
${dept}で政策動向を担当されるご責任者または実務責任者の方にご案内したく、おつなぎいただけますでしょうか。

【担当者との電話】
お時間をいただきありがとうございます。最初に、お名前を確認させていただいてもよろしいでしょうか。

${salesIntroduction(c)}

${salesRelevantMaterials(theme)}

それでは、本日のお電話を踏まえて、政策リサーチの概要と関連する資料を作成し、このあとメールでお送りします。資料をご覧いただいた後に、可能であれば15分程度、オンラインで説明の機会をいただければと思います。メール内容をご確認の上、ご検討の程、よろしくお願いします。

最後に、メールの送り先として、部署名・お名前とメールアドレスを教えていただけますでしょうか。

【電話後メール】
${batchOpening(c)}
先ほどはお電話でお時間をいただき、ありがとうございました。
御社に関係する「${theme}」について、「${trigger}」を含む政府会議・予算・制度資料を横断して確認できます。
15分ほどで「${demo}」という形で実際の資料を2～3件ご説明できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
  }
  if(stage==="10日間トライアル"){
    return `${batchOpening(c)}
御社の「${theme}」から3～5テーマに絞り、10日間無料で政策リサーチを実際にお使いいただけます。
必要情報を拾えるか、情報収集時間が減るか、社内共有に使えるかの3点をご確認いただければ十分です。${note?`\n\n${note}`:""}

${SIGNATURE}`;
  }
  if(stage==="15分商談"){
    return `${batchOpening(c)}
御社に関係する「${theme}」について、15分で実際の政府資料を使ってご説明します。
「${demo}」という流れで、政策形成段階から情報を追える点をご覧いただきます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
  }
  return `${batchOpening(c)}
御社に関係する「${theme}」について、直近の「${trigger}」を含む政策情報をご案内します。
必要に応じて15分程度で実際の資料をご説明できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
}
function generateBulkDocuments(){
  if(APP_MODE!=="bulk") return;
  if(!BULK_SELECTED.size){ alert("対象企業を1社以上選択してください。"); return; }
  const stage=$("bulkStage").value, commonTheme=esc($("bulkCommonTheme").value), note=esc($("bulkCommonNote").value);
  const companies=COMPANY_DATA.filter(c=>BULK_SELECTED.has(c.company));
  LAST_BATCH_DOCS=companies.map(c=>{
    const theme=commonTheme||c.sales_theme||c.secondary||c.industry||"政府政策・予算・制度動向";
    return {company:c.company,status:usageStatus(c),industry:c.industry||"",contact:c.contact||"",subject:batchSubject(c,stage,theme),body:batchBody(c,stage,theme,note)};
  });
  const newCompanies=LAST_BATCH_DOCS.filter(d=>d.status==="完全新規").length;
  if(stage==="利用者" && newCompanies){
    $("bulkWarning").style.display="block";
    $("bulkWarning").textContent=`「利用者」段階ですが、完全新規企業が${newCompanies}社含まれています。該当文面には注意表示を入れています。`;
  }else{
    $("bulkWarning").style.display="none";
  }
  $("bulkOutput").value=LAST_BATCH_DOCS.map(d=>`＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
【${d.company}】 ${d.status} ／ ${d.industry}
件名：${d.subject}

${d.body}`).join("\n\n");
}
function exportBatchCsv(){
  if(APP_MODE!=="bulk") return;
  if(!LAST_BATCH_DOCS.length) generateBulkDocuments();
  if(!LAST_BATCH_DOCS.length) return;
  const rows=[["企業名","利用状況","業種","公開連絡先","件名","本文"],...LAST_BATCH_DOCS.map(d=>[d.company,d.status,d.industry,d.contact,d.subject,d.body])];
  const csv="\ufeff"+rows.map(r=>r.map(csvEscape).join(",")).join("\r\n");
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_一括送付準備_${LAST_BATCH_DOCS.length}社.csv`);
}
function downloadBatchDocx(){
  if(APP_MODE!=="bulk") return;
  if(!LAST_BATCH_DOCS.length) generateBulkDocuments();
  if(!LAST_BATCH_DOCS.length) return;
  const paras=[];
  paras.push({text:"政策リサーチ 一括送付文面",bold:true,size:32});
  paras.push({text:`対象企業：${LAST_BATCH_DOCS.length}社`});
  LAST_BATCH_DOCS.forEach((d,i)=>{
    if(i>0) paras.push({pageBreak:true});
    paras.push({text:d.company,bold:true,size:28});
    paras.push({text:`利用状況：${d.status}　業種：${d.industry}`});
    paras.push({text:`件名：${d.subject}`,bold:true});
    d.body.split(/\n/).forEach(line=>paras.push({text:line}));
  });
  const body=paras.map(p=>{
    if(p.pageBreak) return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    const rpr=(p.bold||p.size)?`<w:rPr>${p.bold?'<w:b/>':''}${p.size?`<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>`:''}<w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>`:'<w:rPr><w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>';
    return `<w:p><w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(p.text||"")}</w:t></w:r></w:p>`;
  }).join("");
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:"word/document.xml",data:documentXml}
  ];
  saveBlob(new Blob([makeZip(files)],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),`政策リサーチ_一括文面_${LAST_BATCH_DOCS.length}社.docx`);
}
function printBatchPdf(){
  if(APP_MODE!=="bulk") return;
  if(!LAST_BATCH_DOCS.length) generateBulkDocuments();
  if(!LAST_BATCH_DOCS.length) return;
  const win=window.open("","_blank");
  if(!win){ alert("ポップアップを許可してください。"); return; }
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>政策リサーチ 一括送付文面</title>
  <style>@page{size:A4;margin:18mm}body{font-family:"Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;color:#222;line-height:1.65;font-size:10.5pt}
  h1{font-size:18pt;color:#17365D}.company{page-break-before:always}.company:first-of-type{page-break-before:auto}h2{font-size:15pt;color:#17365D;border-bottom:2px solid #17365D}pre{white-space:pre-wrap;font-family:inherit}</style>
  </head><body><h1>政策リサーチ 一括送付文面（${LAST_BATCH_DOCS.length}社）</h1>
  ${LAST_BATCH_DOCS.map(d=>`<section class="company"><h2>${xmlEscape(d.company)}</h2><p>利用状況：${xmlEscape(d.status)} ／ 業種：${xmlEscape(d.industry)}</p><p><strong>件名：${xmlEscape(d.subject)}</strong></p><pre>${xmlEscape(d.body)}</pre></section>`).join("")}
  <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`;
  win.document.open();win.document.write(html);win.document.close();
}




function salesPriorityRank(c){
  const order={"S":1,"A":2,"B":3,"C":4};
  return order[c && c.priority_rank] || 9;
}
const COMPANY_NAME_COLLATOR = new Intl.Collator("ja",{
  usage:"sort",
  sensitivity:"base",
  numeric:true,
  ignorePunctuation:true
});
function compareCompanyPriorityName(a,b){
  const pd=salesPriorityRank(a)-salesPriorityRank(b);
  if(pd!==0) return pd;
  return COMPANY_NAME_COLLATOR.compare(a.company||"",b.company||"");
}

function normalizeCompanySearch(s){
  return (s||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
}
function directCompanyRows(){
  const showApproached=$("showApproachedCompanies") && $("showApproachedCompanies").checked;
  return COMPANY_DATA
    .filter(c=>showApproached || !getProgress(c.company).approach_date)
    .slice()
    .sort(compareCompanyPriorityName);
}
function companyOptionText(c){
  const p=getProgress(c.company);
  const base=`[${c.priority_rank||"B"}] ${c.company}`;
  return p.approach_date ? `${base}（アプローチ済 ${p.approach_date}）` : base;
}
function renderDirectCompanyControls(){
  const allSelect=$("companyAllSelect");
  const resultSelect=$("companySearchResults");
  if(!allSelect || !resultSelect) return;

  const rows=directCompanyRows();
  const current=companyByName($("companyInput").value);
  const currentName=current ? current.company : "";

  allSelect.innerHTML='<option value="">会社名から選択</option>' +
    rows.map(c=>`<option value="${xmlEscape(c.company)}">${xmlEscape(companyOptionText(c))}</option>`).join("");
  if(rows.some(c=>c.company===currentName)) allSelect.value=currentName;

  const q=normalizeCompanySearch($("companySearchText").value);
  const matched=q ? rows.filter(c=>normalizeCompanySearch(c.company).includes(q)) : rows;
  resultSelect.innerHTML = matched.length
    ? matched.map(c=>`<option value="${xmlEscape(c.company)}">${xmlEscape(companyOptionText(c))}</option>`).join("")
    : '<option value="">該当する企業がありません</option>';
  if(matched.some(c=>c.company===currentName)) resultSelect.value=currentName;

  const approachedCount=COMPANY_DATA.filter(c=>getProgress(c.company).approach_date).length;
  $("directCompanyNote").textContent =
    `${q ? `検索結果 ${matched.length}社` : `一覧 ${rows.length}社`}。` +
    ($("showApproachedCompanies").checked
      ? `アプローチ済み ${approachedCount}社も表示しています。`
      : `アプローチ済み ${approachedCount}社は除外しています。`);
}
function selectCompanyDirect(name){
  const c=companyByName(name);
  if(!c) return;

  const currentTag=$("industry").value;
  const tag=(currentTag && companyHasTag(c,currentTag))
    ? currentTag
    : (companyTags(c)[0] || c.industry || "");

  if(tag && [...$("industry").options].some(o=>o.value===tag)){
    $("industry").value=tag;
  }

  renderCompanyDropdown();
  $("companyInput").value=c.company;
  $("companyAllSelect").value=c.company;
  renderDirectCompanyControls();
  $("companySearchResults").value=c.company;
  applyCompany();
}

function renderCompanyDropdown(){
  const select=$("companyInput");
  const selectedIndustry=$("industry").value;
  const showApproached=$("showApproachedCompanies") && $("showApproachedCompanies").checked;
  const current=select.value;

  if(!selectedIndustry){
    select.innerHTML='<option value="">先に業種／戦略分野を選択してください</option>';
    select.disabled=true;
    $("companyListNote").textContent="業種／戦略分野を選ぶと、その分野の企業だけを表示します。";
    return;
  }

  const rows=COMPANY_DATA.filter(c=>
    companyHasTag(c,selectedIndustry) &&
    (showApproached || !getProgress(c.company).approach_date)
  ).slice().sort(compareCompanyPriorityName);

  select.disabled=false;
  select.innerHTML='<option value="">企業を選択してください</option>' + rows.map(c=>{
    const p=getProgress(c.company);
    const text=p.approach_date
      ? `${c.company}（アプローチ済 ${p.approach_date}）`
      : c.company;
    return `<option value="${xmlEscape(c.company)}">${xmlEscape(text)}</option>`;
  }).join("");

  if(rows.some(c=>c.company===current)) select.value=current;

  const approachedInIndustry=COMPANY_DATA.filter(c=>
    companyHasTag(c,selectedIndustry) && getProgress(c.company).approach_date
  ).length;

  $("companyListNote").textContent=showApproached
    ? `${selectedIndustry}：${rows.length}社を表示。アプローチ済みは社名の後ろに日付を表示します。`
    : `${selectedIndustry}：未アプローチ ${rows.length}社を表示。アプローチ済み ${approachedInIndustry}社は除外しています。`;
}

function applyCompany(){
  if(APP_MODE!=="single") setAppMode("single");
  const c=companyByName($("companyInput").value);
  if(!c) return;
  $("companyCustom").value="";
  $("legacyConnection").checked=!!c.legacy_connection;
  if(!$("industry").value || !companyHasTag(c,$("industry").value)){
    const fallback=companyTags(c)[0]||c.industry;
    if([...$("industry").options].some(o=>o.value===fallback)){
      $("industry").value=fallback; renderCompanyDropdown(); $("companyInput").value=c.company;
    }
  }
  $("dept").value=c.dept1||"";
  $("person").value=c.person||"";
  $("role").value=c.role||"";
  $("theme").value=c.sales_theme||"";
  $("trigger").value=c.policy_trigger||"";
  $("demo").value=c.demo||"";
  loadProgressIntoForm(c.company);
  if($("companyAllSelect")) $("companyAllSelect").value=c.company;
  if($("companySearchResults")) $("companySearchResults").value=c.company;
  generate();
}
function applyIndustry(){
  const selectedIndustry=$("industry").value;
  const current=companyByName($("companyInput").value);

  if(current && !companyHasTag(current,selectedIndustry)){
    $("companyInput").value="";
    $("companyCustom").value="";
    ["dept","person","role","theme","trigger","demo"].forEach(id=>$(id).value="");
    $("contactDisplay").value="";
    $("contactTypeDisplay").value="";
    $("routeDisplay").value="";
    $("officialUrlDisplay").value="";
    $("sourceUrlDisplay").value="";
    $("historyDisplay").value="";
    $("summaryTags").innerHTML="";
    $("legacyConnection").checked=false;
  resetSelectedCompanySidePanel();
  }

  renderCompanyDropdown();

  const d=INDUSTRY_DEFAULTS[selectedIndustry];
  if(!d) return;
  if(!companyByName($("companyInput").value)){
    $("dept").value=d.dept||"";
    $("theme").value=d.theme||"";
    $("demo").value=d.demo||"";
  }
}

function ctx(){
  const preset=companyByName($("companyInput").value)||{};
  const company=esc($("companyCustom").value)||esc(preset.company)||"対象企業";
  const industry=esc($("industry").value)||esc(preset.industry)||"その他・複合";
  const d=INDUSTRY_DEFAULTS[industry]||INDUSTRY_DEFAULTS["その他・複合"];
  return {
    company,industry,preset,
    legacyConnection:!!$("legacyConnection").checked,
    salesGroup:esc(preset.sales_group)||"完全新規",
    salesAllowed:esc(preset.sales_allowed)||"新規営業対象",
    dept:esc($("dept").value)||esc(preset.dept1)||d.dept,
    person:esc($("person").value)||esc(preset.person),
    role:esc($("role").value)||esc(preset.role),
    theme:esc($("theme").value)||esc(preset.sales_theme)||d.theme,
    trigger:esc($("trigger").value)||esc(preset.policy_trigger),
    demo:esc($("demo").value)||esc(preset.demo)||d.demo,
    contactPerson:esc($("contactPerson").value),
    callNotes:esc($("callNotes").value),
    proposedTimes:esc($("proposedTimes").value), confirmedTime:esc($("confirmedTime").value),
    contact:esc(preset.contact), contactType:esc(preset.contact_type),
    contactLevel:esc(preset.contact_level), route:esc(preset.route),
    contactDeptVerified:esc(preset.contact_department_verified)||esc(preset.dept1),
    contactCheckedDate:esc(preset.contact_checked_date),
    contactRecheckDate:esc(preset.contact_recheck_date),
    contactRecheckStatus:esc(preset.contact_recheck_status),
    contactRecheckScope:esc(preset.contact_recheck_scope),
    contactRecheckSource:esc(preset.contact_recheck_source),
    companyResearch:esc(preset.company_research),
    companyResearchSource:esc(preset.company_research_source)||esc(preset.contact_url)||esc(preset.official_url),
    priorityRank:esc(preset.priority_rank)||"C",
    priorityReason:esc(preset.priority_reason),
    officialUrl:esc(preset.official_url), contactUrl:esc(preset.contact_url),
    planHistory:esc(preset.plan_history), salesChannel:esc(preset.sales_channel),
    usageStatus:esc($("usageStatus").value), additionalTheme:esc($("additionalTheme").value),
    currentDept:esc($("currentDept").value), targetDept:esc($("targetDept").value)
  };
}

function opening(c){
  if(c.salesGroup==="過去有料利用"){
    return `以前「政策リサーチ」をご利用いただいた経緯があり、その後のサービス拡充と、御社に関係する「${c.theme}」の政策動向について改めてご案内したくご連絡しました。`;
  }
  if(c.salesGroup==="トライアルのみ"){
    return `以前「政策リサーチ」をお試しいただいた経緯があり、現在は当時から機能・解説コンテンツを拡充しております。御社に関係する「${c.theme}」の動きもあり、改めてご案内したくご連絡しました。`;
  }
  if(c.salesGroup==="現在利用"){
    return `御社は現在「政策リサーチ」をご利用中です。新規営業ではなく、利用テーマの追加や社内展開のご相談として扱います。`;
  }
  return `日本みらい研では、政府・省庁・国会などの政策情報を収集・整理する法人向けサービス「政策リサーチ」を10年以上運営しております。現在、大手企業だけでも150社前後に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。`;
}

function contactMemo(c){
  if(c.contact) return `公開連絡先：${c.contact}\n推奨ルート：${c.route||c.dept}`;
  return `公開連絡先：未確認\n推奨ルート：${c.route||"公式サイト／代表窓口から"+c.dept+"へ取次ぎ依頼"}`;
}

function contactResearchSummary(c){
  const person=[c.person,c.role].filter(Boolean).join(" ／ ") || "公開担当者名は未確認";
  const dept=c.contactDeptVerified||c.dept||"経営企画・政策渉外等（要確認）";
  const checked=c.contactCheckedDate ? `（確認日 ${c.contactCheckedDate}）` : "";
  return `【選択企業・営業連絡先】
企業名：${c.company}
営業優先ランク：${c.priorityRank}
代表電話／公開窓口：${c.contact||"未登録・要確認"}
担当部署／推奨営業先：${dept}
公開担当者・役職：${person}
連絡先確認：${c.contactLevel||"要確認"}${checked}
公式再確認：${c.contactRecheckStatus||"未実施"}${c.contactRecheckDate ? `（${c.contactRecheckDate}）` : ""}`;
}

function generate(){
  const c=ctx();
  const isUserStage = $("stage").value==="利用者";
  const tr=c.trigger||"直近の政府会議・予算・制度動向";
  const cp=c.contactPerson ? c.contactPerson+" " : "ご担当者様";
  const notes=c.callNotes ? `お電話では「${c.callNotes}」と伺いました。` : "お電話で伺った御社の関心テーマを踏まえ、";
  const blocked=c.salesGroup==="現在利用";

  $("outReception").value = blocked ?
`【既存顧客】${c.company}様は現在利用中です。新規営業電話は行わず、利用状況確認・テーマ追加・他部署展開の連絡として扱ってください。

${contactMemo(c)}` :
`突然のお電話で失礼いたします。一般社団法人日本みらい研の髙松と申します。

${opening(c)}

${honorific(c.company)}の場合、特に「${c.theme}」との関係が深いことから、政府関連情報の有効な活用方法についてお話しいたしたくご連絡しました。${c.trigger?`

直近では「${c.trigger}」も動いています。`:""}

${c.dept}で政府政策・予算・制度動向を担当されるご責任者、もしくは実務責任者の方に一度ご案内したいのですが、おつなぎいただけますでしょうか。

【連絡先メモ】
${contactMemo(c)}`;

  $("outConnected").value =
`お時間をいただきありがとうございます。日本みらい研の代表理事をしている髙松と申します。

最初に、お名前を確認させていただいてもよろしいでしょうか。

${salesIntroduction(c)}

${salesRelevantMaterials(c.theme)}

それでは、本日のお電話を踏まえて、政策リサーチの概要と関連する資料を作成し、このあとメールでお送りします。資料をご覧いただいた後に、可能であれば15分程度、オンラインで説明の機会をいただければと思います。メール内容をご確認の上、ご検討の程、よろしくお願いします。

最後に、メールの送り先として、部署名・お名前とメールアドレスを教えていただけますでしょうか。`;

  const subject=c.salesGroup==="過去有料利用" ?
    `【政策リサーチ】以前のご利用御礼と、${c.theme}に関する最新政策のご案内` :
    c.salesGroup==="トライアルのみ" ?
    `【政策リサーチ】以前のトライアル御礼と、${c.theme}に関するご案内` :
    `【先ほどのお電話の件】${c.company}様の${c.theme}に関する政策資料のご案内`;

  $("outEmailFollow").value =
`【電話後に送るメール】

件名：${subject}

${c.contactPerson ? c.contactPerson+"様" : "ご担当者様"}

先ほどはお電話でお時間をいただき、ありがとうございました。
${notes}

御社の「${c.theme}」に関係する政府会議・予算・制度などに関して簡単にまとめた資料を添付にてお送りします。こちらは、政策リサーチ上で確認できる資料をベースに作成したものです。政策リサーチのサービス内容は、以下のURLをご参照ください。

https://report.rifj.jp/pr/

その上で、可能であれば15分程度のオンラインでの説明の機会をいただければと思います。

ご都合のよい日時がございましたら、ご連絡いただければ幸いです。日時はできれば2、3候補を挙げていただければ幸いです。お手数をおかけしますが、よろしくお願いします。

${SIGNATURE}

────────────────────────
【返信・反応がない場合：2～3営業日後の再フォロー電話】

「先日お電話でお話しし、${c.theme}に関する資料をお送りした日本みらい研の髙松です。資料はご覧いただけましたでしょうか。お電話でお話ししたように、可能であれば15分程度、オンラインでご説明できればと思っています。ご都合のよい日時を2、3候補いただければ、その中で調整いたします。」`;

  $("outScheduleReply").value =
`件名：Re: 【政策リサーチ】オンライン説明の日程について

${c.contactPerson ? c.contactPerson+"様" : "ご担当者様"}

ご返信ありがとうございます。

${c.proposedTimes ? `ご提示いただいた候補日時（${c.proposedTimes}）の中から、` : "ご提示いただいた候補日時の中から、"}${c.confirmedTime ? `「${c.confirmedTime}」でお願いできればと思います。` : "【確定日時を入力してください】でお願いできればと思います。"}

当日は15分程度、オンラインでご説明させていただきます。

Zoom URL：
https://us06web.zoom.us/j/81782664122?pwd=YXRmUnBjdEZPbGpST2pPSmFrakI2dz09

それでは、当日はどうぞよろしくお願いいたします。

${SIGNATURE}`;

  $("outMeeting").value =
`【0:00–1:30｜実績・位置づけ】
「本日はありがとうございます。政策リサーチは10年以上運営しており、現在、大手企業だけでも150社前後に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。政策リサーチでは、このような企業の皆様が、政府関連情報を探したり分析をする際にご活用いただいております。」

【1:30–3:00｜先日のお電話内容を確認】
「先日のお電話では、${c.callNotes||"御社で現在追っておられる政策テーマや情報収集の状況"}についてお話を伺いました。今日は、その点に関係する政策情報を実際の資料でご覧いただきます。」

【3:00–5:00｜なぜ御社に関係するのか】
「御社では『${c.theme}』が特に関係すると考えています。政策は、発表された後に知るのではなく、審議会や予算要求、制度設計の段階から把握できると、事業計画や投資判断、規制対応の準備を早く始めることができます。」

【5:00–9:00｜御社に関係する“今動いている政策”を実資料で確認】
「ここからは、御社に直接関係する資料を3つの視点で見てみます。
1つ目は『何を政府が課題と認識しているか』。
2つ目は『どの省庁・会議で同じ方向の議論が進んでいるか』。
3つ目は『予算・制度として実際に何が動き始めているか』です。」

${c.demo ? `まず「${c.demo}」という流れで、複数省庁・会議体・予算・制度を横断して確認します。` : "複数省庁・会議体・予算・制度を同じテーマで横断して確認します。"}

「ポイントは、1件の資料を読むことではなく、バラバラに出てくる政策情報をつなげて『政府がどちらへ動いているのか』を早い段階で掴むことです。」

【9:00–11:30｜“御社にとって何が変わるか”まで落とし込む】
「この動きが進んだ場合、御社では、①新しい事業機会、②規制や対応負担、③予算・補助制度、④競合や取引先への影響のうち、どこが一番大きそうでしょうか。」

「政策リサーチでは、資料を探して終わりではなく、この政策変化が自社に何を意味するのかを考える材料まで短時間で揃えることを目的にしています。」

※ 相手の回答に応じて、その場で関連資料・当日解説・政策レポートを見せる。

【11:30–13:00｜社内で“使える情報”にする】
「政策情報は、担当者が見つけても、経営や事業部門へ共有できなければ活用されません。政策リサーチでは、原資料、要点、解説を一緒に確認できるため、経営企画、事業部門、法務・規制対応、研究開発などへ共有する際の下準備を短縮できます。」

【13:00–14:15｜10日間で御社自身に検証していただく】
「ここまでの説明だけで判断いただく必要はありません。御社で本当に追いたいテーマを3～5件だけ決めていただき、10日間、実際の政策情報でお試しください。

確認いただきたいのは、
①必要な情報を早く拾えるか
②調査・整理時間を減らせるか
③社内の判断材料として使えるか
の3点です。」

【14:15–15:00｜次の一歩を具体化】
「もし御社で試すとすれば、最初に追うべきテーマは何がよいでしょうか。今日ご覧いただいた『${c.theme}』を含め、3～5件を一緒に決めて、10日間の無料トライアルから確認していただくのが一番分かりやすいと思います。いかがでしょうか。」`;

  $("outTrial").value =
`御社の関心テーマを3～5件に絞り、10日間無料で実際にお使いいただくのが一番分かりやすいと思います。

候補は「${c.theme}」です。

確認いただくのは、
1. 必要な政策情報を見落とさず拾えるか
2. 情報収集・整理の時間が減るか
3. 社内共有に使いやすいか
の3点です。

検索、閲覧、当日解説、アラート、週2回の政策レポートなど、通常サービスをそのままご確認いただけます。`;

  $("outClosing").value =
`10日間のご利用を踏まえ、御社では「${c.theme}」の情報収集と社内共有に活用余地があると考えています。

正式導入をご検討いただく場合、次の4点を確認させてください。
1. 最初に利用する部署
2. 必要なID数
3. 導入希望時期
4. 社内の決裁フロー

保留の場合は、価格を急いで調整するのではなく、次に検討しやすい予算時期または政策イベントを決め、その時点で改めてご連絡します。`;


  $("outUsage").value =
`【電話】
いつも政策リサーチをご利用いただきありがとうございます。日本みらい研の髙松です。

${c.usageStatus ? `現在は「${c.usageStatus}」というご利用状況と伺っています。` : "現在のご利用状況を確認し、より活用いただける余地があるのではと思いご連絡しました。"}

御社で重点的に追っている「${c.theme}」に合わせて、検索だけでなく、当日解説、週2回の政策レポート、アラートなどを組み合わせると、さらに効率よくご利用いただけます。

${c.trigger ? `ちょうど「${c.trigger}」も動いていますので、` : ""}御社の実際のテーマを使って15分ほど活用方法を整理してご案内できます。

【メール】
件名：【政策リサーチ】ご利用状況の確認と活用方法のご案内

いつも政策リサーチをご利用いただき、ありがとうございます。

${c.usageStatus ? `現在のご利用状況として「${c.usageStatus}」と伺っております。` : "現在のご利用状況を踏まえ、より効率的にご活用いただける方法をご案内したくご連絡しました。"}

特に「${c.theme}」については、検索に加えて当日解説、政策レポート、アラートを組み合わせることで、情報収集から社内共有までの負担を減らせます。

${c.trigger ? `直近の「${c.trigger}」も含め、` : ""}御社向けに15分程度で具体的な使い方をご説明できます。必要であれば、現在の業務に合わせて設定も一緒に確認いたします。

${SIGNATURE}`;

  $("outThemeAdd").value =
`【電話】
いつも政策リサーチをご利用いただきありがとうございます。

現在追っていただいている「${c.theme}」に加えて、${c.additionalTheme ? `「${c.additionalTheme}」` : "新たな関連テーマ"}も御社事業との関係が深くなっていると考えています。

${c.trigger ? `直近では「${c.trigger}」も動いており、` : ""}既存テーマと新しいテーマを一緒に追うことで、政策のつながりが見えやすくなります。

まず関連資料を2～3件だけお見せし、追加監視する価値があるかご確認いただければと思います。

【メール】
件名：【政策リサーチ】追加でご覧いただきたい${c.additionalTheme ? `「${c.additionalTheme}」` : "政策テーマ"}について

いつも政策リサーチをご利用いただき、ありがとうございます。

現在ご利用いただいている「${c.theme}」に関連して、${c.additionalTheme ? `「${c.additionalTheme}」` : "新しい政策テーマ"}でも御社事業に関係する動きが増えています。

${c.trigger ? `特に「${c.trigger}」は関連性が高く、` : ""}政策リサーチ上で既存テーマと横断して追うことで、政策の背景や今後の方向性を把握しやすくなります。

まず2～3件の資料をご覧いただき、継続的に監視するテーマとして追加する価値があるか、一緒に確認できればと思います。

${SIGNATURE}`;

  $("outDeptExpand").value =
`【電話】
いつも政策リサーチをご利用いただきありがとうございます。

現在${c.currentDept ? `「${c.currentDept}」` : "現在のご利用部署"}でお使いいただいていますが、「${c.theme}」は${c.targetDept ? `「${c.targetDept}」` : "他の関連部署"}にも関係が深いと考えています。

新しいサービスを別途導入するというより、すでに御社で使っている政策情報基盤を社内で共有する形です。

${c.targetDept ? `「${c.targetDept}」` : "候補部署"}向けに、その部署に関係する実際の政策資料を2～3件だけ使い、10分程度でご説明できます。まず現在のご担当者様からご紹介いただく形がよいと思います。

【メール】
件名：【政策リサーチ】${c.targetDept ? `「${c.targetDept}」` : "他部署"}での活用について

いつも政策リサーチをご利用いただき、ありがとうございます。

現在${c.currentDept ? `「${c.currentDept}」` : "現在のご利用部署"}でご利用いただいている政策リサーチについて、「${c.theme}」は${c.targetDept ? `「${c.targetDept}」` : "他の関連部署"}でも活用余地があると考えています。

新たな情報サービスを追加するのではなく、既に御社で利用している政策情報基盤を、必要な部署へ広げる考え方です。

候補部署に関係する政策資料を2～3件だけ使い、10分程度でご説明できます。もし適切なご担当者様がいらっしゃれば、ご紹介いただけますと幸いです。

${SIGNATURE}`;


  if(isUserStage){
    const st = c.salesGroup==="現在利用" ? "現在利用中" : c.salesGroup==="過去有料利用" ? "利用後退会" : c.salesGroup==="トライアルのみ" ? "トライアルのみ" : "完全新規";
    if(st==="現在利用中"){
      $("outConnected").value=`いつも政策リサーチをご利用いただきありがとうございます。現在のご利用状況と、最近重点的に追っておられる政策テーマを確認したくご連絡しました。\n\n「${c.theme}」に関連する最新動向も踏まえ、利用促進、テーマ追加、他部署展開のうち、御社で有効な使い方を15分ほどで整理してご案内できます。`;
      $("outEmailFollow").value=`件名：【政策リサーチ】ご利用状況と「${c.theme}」の最新政策について\n\nいつも政策リサーチをご利用いただき、ありがとうございます。\n\n現在のご利用状況を踏まえ、より活用いただける方法をご案内したくご連絡しました。特に「${c.theme}」については、当日解説、政策レポート、アラート等を組み合わせることで、情報収集から社内共有まで効率化できます。\n\n15分ほど、現在のご利用状況を伺いながら、利用促進・テーマ追加・他部署展開の可能性を整理してご案内できます。\n\n${SIGNATURE}`;
    }else if(st==="利用後退会"){
      $("outConnected").value=`以前、政策リサーチをご利用いただきありがとうございました。その後、当日解説、AI解析、週2回の政策レポート等を拡充しています。\n\n御社に関係する「${c.theme}」でも新しい政策動向が続いており、以前のご利用時点との違いを15分ほどでご説明できます。`;
      $("outEmailFollow").value=`件名：【政策リサーチ】以前のご利用御礼と「${c.theme}」の最新動向\n\n以前、政策リサーチをご利用いただき、ありがとうございました。\n\nその後、サービス内容を拡充しており、現在は当日解説、AI解析、週2回の政策レポート等もご利用いただけます。\n\n御社に関係する「${c.theme}」の最新政策を使って、以前との違いを15分程度でご説明できます。\n\n${SIGNATURE}`;
    }else if(st==="トライアルのみ"){
      $("outConnected").value=`以前、政策リサーチをお試しいただきありがとうございました。現在は当時から機能・解説コンテンツを拡充しています。\n\n「${c.theme}」の直近政策を使って、現在のサービスを15分ほどで改めてご覧いただけます。`;
      $("outEmailFollow").value=`件名：【政策リサーチ】以前のトライアル御礼と「${c.theme}」の最新動向\n\n以前、政策リサーチをお試しいただき、ありがとうございました。\n\n現在は当日解説、AI解析、政策レポート等を拡充しています。「${c.theme}」の最近の政策動向を使って、現在のサービスを15分程度で改めてご説明できます。\n\n${SIGNATURE}`;
    }else{
      $("outConnected").value=`【注意】この企業は完全新規のため、「利用者」接触段階は通常適しません。初回電話または電話後メールをご利用ください。`;
      $("outEmailFollow").value=`【注意】この企業は完全新規です。「利用者」向け文面ではなく、新規営業文面を使用してください。`;
    }
  }

  render(c);
}

function usageHistorySummary(preset){
  if(!preset || !preset.company) return "利用履歴はありません。";
  if(preset.membership_state==="現在利用中"){
    return `会員名簿では現在利用中です。登録日 ${preset.membership_start_date||"不明"} からの利用履歴があり、有料利用を優先した表示プランは「${preset.membership_priority_plan||preset.membership_current_plan||"不明"}」です。新規営業ではなく、利用促進・テーマ追加・他部署展開を優先します。`;
  }
  if(preset.membership_state==="退会・現在未利用"){
    const kind=preset.membership_paid_history ? "過去に有料利用" : (preset.membership_trial_history ? "過去にトライアル利用" : "過去に利用");
    return `会員名簿では現在は利用していません。${kind}の履歴があり、初回登録日は ${preset.membership_start_date||"不明"} です。再アプローチでは、当時との機能差分と現在の政策テーマを軸に提案します。`;
  }
  const st=usageStatus(preset);
  if(st==="現在利用中") return "現在、政策リサーチをご利用中です。新規営業ではなく、利用促進・テーマ追加・他部署展開の対象です。";
  if(st==="利用後退会") return "過去に政策リサーチを有料利用した履歴があります。再アプローチでは、当時との機能差分と現在の政策テーマを軸に提案します。";
  if(st==="トライアルのみ") return "過去に政策リサーチのトライアル利用履歴があります。現在の機能拡充と新しい政策テーマを軸に再提案します。";
  return "政策リサーチの利用履歴は確認されていません。完全新規の営業対象です。";
}
function renderSelectedCompanySidePanel(c){
  const preset=c && c.preset ? c.preset : companyByName(c && c.company ? c.company : "") || null;
  const name=(c && c.company) || (preset && preset.company) || "企業を選択してください";
  const rank=(preset && preset.priority_rank) || "B";
  const usage=preset ? usageStatus(preset) : "—";
  const auto=preset ? progressAuto(preset.company) : {status:"未記録"};

  $("selectedCompanyName").textContent=name;
  $("selectedCompanyRank").textContent=preset ? `${rank}ランク` : "—";
  $("selectedCompanyRank").className=`company-badge rank-badge rank-${rank.toLowerCase()}`;
  $("selectedCompanyUsage").textContent=usage;
  $("selectedCompanyIndustry").textContent=(preset && preset.industry) || (c && c.industry) || "—";
  $("selectedCompanyTags").textContent=preset ? companyTags(preset).join("・") : "—";
  $("selectedCompanyProgress").textContent=auto.status || "未記録";
  $("selectedCompanyPhone").textContent=(preset && preset.contact) || "未登録・要確認";
  $("selectedCompanyDept").textContent=(preset && (preset.contact_department_verified||preset.dept1)) || "要確認";
  $("selectedCompanyPerson").textContent=preset
    ? ([preset.person,preset.role].filter(Boolean).join(" ／ ") || "公開担当者名は未確認")
    : "—";
  $("selectedCompanyContactCheck").textContent=preset
    ? ([preset.contact_level,preset.contact_checked_date ? `確認日 ${preset.contact_checked_date}` : ""].filter(Boolean).join(" ／ ") || "要確認")
    : "—";
  $("selectedCompanyRecheck").textContent=preset
    ? ([preset.contact_recheck_status,preset.contact_recheck_date].filter(Boolean).join(" ／ ") || "未実施")
    : "—";
  $("selectedCompanyResearch").textContent=preset
    ? `${preset.company_description||preset.company_research||"企業詳細は既存マスタ情報を参照してください。"}\n\n営業観点：${preset.priority_reason||"—"}\n情報源：${preset.company_research_source||preset.contact_recheck_source||preset.contact_url||preset.official_url||"—"}`
    : "—";
  $("selectedCompanyHistory").textContent=preset ? usageHistorySummary(preset) : "企業を選択すると、利用履歴を表示します。";
  $("selectedMembershipStart").textContent=(preset && preset.membership_start_date) || "—";
  $("selectedMembershipState").textContent=(preset && preset.membership_state) || "—";
  $("selectedMembershipPlan").textContent=(preset && (preset.membership_priority_plan||preset.membership_current_plan)) || "—";
  $("selectedMembershipRows").textContent=preset && preset.membership_rows
    ? `有効 ${preset.membership_valid_rows||0} / 無効 ${preset.membership_invalid_rows||0}`
    : "—";
  $("selectedMembershipBasis").textContent=(preset && preset.membership_basis)
    ? `${preset.membership_basis}。登録日を利用開始日として判定。`
    : "会員名簿の一致データはありません。";

  const history=(preset && preset.membership_plan_history)
    ? `会員名簿プラン履歴：${preset.membership_plan_history}${preset.membership_related_history ? "\n関連・旧名履歴：\n"+preset.membership_related_history : ""}`
    : ((preset && preset.plan_history) ? preset.plan_history : "");
  const merged=(preset && preset.legacy_history_source) ? `\n旧登録名・部門：${preset.legacy_history_source}` : "";
  $("selectedCompanyPlanHistory").textContent=history ? `${history}${merged}` : (merged.trim() || "具体的な過去プラン・登録履歴は未登録です。");

  $("selectedCompanyRankReason").textContent=(preset && preset.priority_reason) || "—";
}


function resetSelectedCompanySidePanel(){
  $("selectedCompanyName").textContent="企業を選択してください";
  $("selectedCompanyRank").textContent="—";
  $("selectedCompanyRank").className="company-badge rank-badge";
  $("selectedCompanyUsage").textContent="—";
  $("selectedCompanyIndustry").textContent="—";
  $("selectedCompanyTags").textContent="—";
  $("selectedCompanyProgress").textContent="—";
  $("selectedCompanyPhone").textContent="—";
  $("selectedCompanyDept").textContent="—";
  $("selectedCompanyPerson").textContent="—";
  $("selectedCompanyContactCheck").textContent="—";
  $("selectedCompanyRecheck").textContent="—";
  $("selectedCompanyResearch").textContent="—";
  $("selectedCompanyHistory").textContent="企業を選択すると、利用履歴を表示します。";
  $("selectedMembershipStart").textContent="—";
  $("selectedMembershipState").textContent="—";
  $("selectedMembershipPlan").textContent="—";
  $("selectedMembershipRows").textContent="—";
  $("selectedMembershipBasis").textContent="—";
  $("selectedCompanyPlanHistory").textContent="—";
  $("selectedCompanyRankReason").textContent="—";
}
function render(c){
 renderSelectedCompanySidePanel(c);
 const auto=companyByName(c.company)?progressAuto(c.company):{status:"未記録",incomplete:""};
 const tags=[`優先ランク：${c.preset?.priority_rank||"B"}`,`企業：${c.company}`,`営業区分：${c.salesGroup}`,`営業可否：${c.salesAllowed}`,`選択分野：${c.industry}`,`検索分野：${companyTags(c.preset).join("・")}`,`部署：${c.dept}`,`進捗：${auto.status}`];
 if(c.legacyConnection){
   tags.push(c.preset?.legacy_connection ? "旧縁：あり（マスタ○）" : "旧縁：あり（手動）");
 }
 if(auto.incomplete) tags.push(`未了：${auto.incomplete}`);
 $("summaryTags").innerHTML=tags.map(t=>`<span class="tag">${t}</span>`).join("");
 $("contactDisplay").value=c.contact||"未登録／要確認";
 $("contactTypeDisplay").value=[c.contactType,c.contactLevel].filter(Boolean).join("／")||"未確認";
 $("routeDisplay").value=c.route||"公式サイト／代表窓口を確認";
 $("officialUrlDisplay").value=c.officialUrl||"";
 $("sourceUrlDisplay").value=c.contactUrl||"";
 $("historyDisplay").value=c.planHistory||"";

 $("statusNotice").textContent = c.salesGroup==="現在利用"
  ? "現在利用中：新規営業対象外。利用促進・テーマ追加・他部署展開の提案として扱ってください。"
  : c.salesGroup==="過去有料利用"
  ? "過去有料利用：完全新規ではなく、以前の利用実績を踏まえた再アプローチ文を生成します。"
  : c.salesGroup==="トライアルのみ"
  ? "過去トライアル：以前試した経緯を踏まえ、現在の機能拡充と新しい政策テーマから再提案します。"
  : "完全新規：電話で一次接触し、会話内容を反映したメールを同日送付する基本フローです。";
}

function outputSections(){
  const ids=[
    ["代表受付・ファーストコンタクト","outReception"],
    ["担当者との電話トーク","outConnected"],
    ["電話後メール＋必要時の再フォロー","outEmailFollow"],
    ["日時指定の返信メール","outScheduleReply"],
    ["15分商談トークライン","outMeeting"],
    ["10日間無料トライアル提案","outTrial"],
    ["クロージング","outClosing"],
    ["既存顧客：利用促進","outUsage"],
    ["既存顧客：テーマ追加","outThemeAdd"],
    ["既存顧客：他部署展開","outDeptExpand"]
  ];
  return ids.map(([title,id])=>({title,text:$(id).value||""}));
}

function fullOutputText(){
  const c=ctx();
  const head=`政策リサーチ 営業アプローチ文面\n企業：${c.company}\n営業区分：${c.salesGroup}\n業種：${c.industry}\n\n`;
  return head + contactResearchSummary(c) + "\n\n" + outputSections().map(s=>`■ ${s.title}\n${s.text}`).join("\n\n");
}

function saveBlob(blob, filename){
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function xmlEscape(s){
  return (s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

// Minimal ZIP writer (STORE/no compression) used to create a true .docx file offline.
function crc32(bytes){
  let table=crc32.table;
  if(!table){
    table=[];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      table[n]=c>>>0;
    }
    crc32.table=table;
  }
  let crc=0^(-1);
  for(let i=0;i<bytes.length;i++) crc=(crc>>>8)^table[(crc^bytes[i])&0xFF];
  return (crc^(-1))>>>0;
}
function u16(n){ return new Uint8Array([n&255,(n>>>8)&255]); }
function u32(n){ return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]); }
function concatArrays(arrays){
  const len=arrays.reduce((a,b)=>a+b.length,0), out=new Uint8Array(len);
  let p=0; arrays.forEach(a=>{out.set(a,p);p+=a.length;}); return out;
}
function makeZip(files){
  const enc=new TextEncoder(), locals=[], centrals=[];
  let offset=0;
  for(const f of files){
    const name=enc.encode(f.name), data=(f.data instanceof Uint8Array)?f.data:enc.encode(f.data), crc=crc32(data);
    const local=concatArrays([
      u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),
      u16(name.length),u16(0),name,data
    ]);
    locals.push(local);
    const central=concatArrays([
      u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),
      u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name
    ]);
    centrals.push(central); offset+=local.length;
  }
  const centralData=concatArrays(centrals);
  const end=concatArrays([
    u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),
    u32(centralData.length),u32(offset),u16(0)
  ]);
  return concatArrays([...locals,centralData,end]);
}

function downloadDocx(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=ctx();
  const sections=outputSections();
  const paras=[];
  paras.push({text:"政策リサーチ 営業アプローチ文面",bold:true,size:32});
  paras.push({text:`企業：${c.company}`});
  paras.push({text:`営業区分：${c.salesGroup}`});
  paras.push({text:`業種：${c.industry}`});
  paras.push({text:""});
  paras.push({text:"営業連絡先",bold:true,size:26});
  for(const line of contactResearchSummary(c).split(/\n/)) paras.push({text:line});
  paras.push({text:""});
  for(const s of sections){
    paras.push({text:s.title,bold:true,size:26});
    for(const line of s.text.split(/\n/)) paras.push({text:line});
    paras.push({text:""});
  }
  const body=paras.map(p=>{
    const rpr=(p.bold||p.size)?`<w:rPr>${p.bold?'<w:b/>':''}${p.size?`<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>`:''}<w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>`:'<w:rPr><w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>';
    return `<w:p><w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(p.text)}</w:t></w:r></w:p>`;
  }).join("");
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body></w:document>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:"word/document.xml",data:documentXml}
  ];
  const zip=makeZip(files);
  saveBlob(new Blob([zip],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),`政策リサーチ_営業文面_${c.company}.docx`);
}

function printPdf(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=ctx(), sections=outputSections();
  const win=window.open("","_blank");
  if(!win){ alert("ポップアップがブロックされています。ブラウザでポップアップを許可してください。"); return; }
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>政策リサーチ 営業文面 ${xmlEscape(c.company)}</title>
  <style>
  @page{size:A4;margin:18mm} body{font-family:"Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;color:#222;line-height:1.65;font-size:10.5pt}
  h1{font-size:18pt;color:#17365D;border-bottom:2px solid #17365D;padding-bottom:6px}
  h2{font-size:13pt;color:#17365D;margin-top:20px;border-left:4px solid #245B89;padding-left:8px}
  .meta{background:#eef5fb;padding:10px 12px;border:1px solid #d8e2ec}
  pre{white-space:pre-wrap;font-family:inherit;margin:6px 0 16px}
  </style></head><body>
  <h1>政策リサーチ 営業アプローチ文面</h1>
  <div class="meta">企業：${xmlEscape(c.company)}<br>営業区分：${xmlEscape(c.salesGroup)}<br>業種：${xmlEscape(c.industry)}</div>
  <h2>営業連絡先</h2><pre>${xmlEscape(contactResearchSummary(c))}</pre>
  ${sections.map(s=>`<h2>${xmlEscape(s.title)}</h2><pre>${xmlEscape(s.text)}</pre>`).join("")}
  <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
  </body></html>`;
  win.document.open(); win.document.write(html); win.document.close();
}

function csvEscape(v){
  const s=(v??"").toString().replace(/"/g,'""');
  return `"${s}"`;
}
const COMPANY_EXPORT_FIELDS=[
  ["企業名","company"],["営業優先スコア","priority_score"],["営業優先ランク","priority_rank"],["公開連絡先","contact"],["営業区分","sales_group"],
  ["主業種・戦略分野","industry"],["検索用分野タグ","search_tags"],["副テーマ","secondary"],
  ["会員名簿判定","membership_state"],["優先表示プラン（有料優先）","membership_priority_plan"],["現在ステータス上のプラン","membership_current_plan"],
  ["利用開始日（登録日）","membership_start_date"],["会員名簿プラン履歴（有料優先）","membership_plan_history"],
  ["有効件数","membership_valid_rows"],["無効件数","membership_invalid_rows"],["判定根拠","membership_basis"],["照合ルール","membership_match_rule"],
  ["ランク理由","priority_reason"],["営業可否","sales_allowed"],["上場・企業区分","listing_status"],["証券コード","ticker"],["名簿区分","master_segment"],
  ["第1営業先部署","dept1"],["第2営業先部署","dept2"],["公開キーパーソン","person"],["公開役職・接点","role"],
  ["連絡先種別","contact_type"],["連絡先確認","contact_level"],["企業公式URL","official_url"],["連絡先・根拠URL","contact_url"],
  ["推奨初回接触ルート","route"],["確認済み担当部署／推奨営業先","contact_department_verified"],["連絡先調査日","contact_checked_date"],
  ["公式再確認日","contact_recheck_date"],["公式再確認状況","contact_recheck_status"],["公式再確認対象","contact_recheck_scope"],["公式再確認情報源","contact_recheck_source"],
  ["最初に刺すテーマ","sales_theme"],["企業説明","company_description"],["直近政策トリガー","policy_trigger"],["15分デモ内容","demo"],
  ["過去プラン・履歴","plan_history"],["販売チャネル","sales_channel"],["正式法人名確認","official_name_check"],["旧表示名","legacy_company_name"],
  ["旧縁あり","legacy_connection"],["旧縁判定元","legacy_connection_source"]
];
function companyToCsvRows(list){
  const pHeaders=["初回アプローチ日","最終返信日","オンライン会議日","申込完了日","拒否日","営業メモ・履歴","営業進捗","未了判定","経過日数"];
  const header=[...COMPANY_EXPORT_FIELDS.map(x=>x[0]),...pHeaders];
  const rows=list.map(c=>{
    const p=getProgress(c.company), a=progressAuto(c.company);
    return [...COMPANY_EXPORT_FIELDS.map(x=>Array.isArray(c[x[1]])?c[x[1]].join("｜"):(c[x[1]]??"")),p.approach_date,p.reply_date,p.meeting_date,p.applied_date,p.rejected_date,p.note||"",a.status,a.incomplete,a.elapsed];
  });
  return [header,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");
}
function exportBulkSelectedCompaniesCsv(){
  if(APP_MODE!=="bulk") return;
  if(!BULK_SELECTED.size){ alert("一覧に出力する企業を1社以上選択してください。"); return; }
  const selected=COMPANY_DATA
    .filter(c=>BULK_SELECTED.has(c.company))
    .slice()
    .sort(compareCompanyPriorityName);
  const csv="\ufeff"+companyToCsvRows(selected);
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_選択企業一覧_${selected.length}社.csv`);
}

function exportSelectedCsv(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=companyByName($("companyInput").value);
  if(!c){ alert("登録企業を1社選択してください。"); return; }
  const csv="\ufeff"+companyToCsvRows([c]);
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_企業データ_${c.company}.csv`);
}
function exportAllCsv(){
  const csv="\ufeff"+companyToCsvRows(COMPANY_DATA);
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_企業マスタ_${COMPANY_DATA.length}社.csv`);
}
function exportAllJson(){
  const merged=COMPANY_DATA.map(c=>({...c,progress:getProgress(c.company),auto_progress:progressAuto(c.company)}));
  saveBlob(new Blob([JSON.stringify(merged,null,2)],{type:"application/json;charset=utf-8"}),`政策リサーチ_企業マスタ_${COMPANY_DATA.length}社.json`);
}

function clearCompanySelection(){
  resetSelectedCompanySidePanel();
  if($("companyAllSelect")) $("companyAllSelect").value="";
  if($("companySearchResults")) $("companySearchResults").value="";
  if($("companySearchText")) $("companySearchText").value="";

  if(APP_MODE!=="single") setAppMode("single");
  $("companyInput").value="";
  $("companyCustom").value="";
  $("legacyConnection").checked=false;
  ["dept","person","role","theme","trigger","demo","contactPerson","callNotes","proposedTimes","confirmedTime","usageStatus","additionalTheme","currentDept","targetDept"].forEach(id=>$(id).value="");
  $("contactDisplay").value="";
  $("contactTypeDisplay").value="";
  $("routeDisplay").value="";
  $("officialUrlDisplay").value="";
  $("sourceUrlDisplay").value="";
  $("historyDisplay").value="";
  ["progressApproachDate","progressReplyDate","progressMeetingDate","progressAppliedDate","progressRejectedDate"].forEach(id=>$(id).value="");
  $("progressNote").value="";
  renderCurrentProgressStatus();
  $("statusNotice").textContent="企業選択をクリアしました。新しい企業名を入力してください。";
  $("summaryTags").innerHTML="";
  document.querySelectorAll(".results textarea").forEach(el=>el.value="");
  renderCompanyDropdown();
  $("companyInput").focus();
}

function downloadAll(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=ctx();
  const text=fullOutputText();
  saveBlob(new Blob([text],{type:"text/plain;charset=utf-8"}),`政策リサーチ_営業文面_${c.company}.txt`);
}
function resetForm(){
  setAppMode("single");
 ["companyInput","companyCustom","person","role","contactPerson","trigger","callNotes","proposedTimes","confirmedTime","extra","usageStatus","additionalTheme","currentDept","targetDept"].forEach(id=>$(id).value="");
 $("industry").selectedIndex=0; $("stage").selectedIndex=0;
 $("legacyConnection").checked=false;
 $("dept").value=""; $("theme").value=""; $("demo").value=""; applyIndustry(); generate();
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",init);
else init();


