
            document.addEventListener('DOMContentLoaded', () => {
                
                if (typeof blogData !== 'undefined') {
                    initializeApp(blogData);
                } else {
                    console.error("Could not find blogData. Make sure data.js is loaded before app.js.");
                    document.body.innerHTML = '<div class="p-8 text-center text-red-600">データ(data.js)の読み込みに失敗しました。</div>';
                }
            
            });
            
            function initializeApp(files) {
                const getEl = id => document.getElementById(id);
                const listContainer = getEl('list'),
                    preview = getEl('preview'),
                    search = getEl('search'),
                    itemCountEl = getEl('itemCount'),
                    paginationControls = getEl('pagination-controls'),
                    paginationControlsTop = getEl('pagination-controls-top'),
                    sortKeySelect = getEl('sortKeyExport'),
                    sortOrderSelect = getEl('sortOrderExport'),
                    clearSearchBtn = getEl('clearSearchBtnExport');
            
                let currentFilteredFiles = [];
                let currentPage = 1;
                const itemsPerPage = 10;
                let currentSort = { key: 'date', order: 'desc' };
            
                const escapeHtml = str => {
                    const p = document.createElement('p');
                    p.textContent = str || '';
                    return p.innerHTML;
                };
            
                const injectResponsiveStyles = content => {
                    const style = '<style>html,body{max-width:100%!important;overflow-x:hidden!important}img,iframe,video{max-width:100%!important;height:auto!important}<\/style>';
                    return content.includes('</head>') ? content.replace('</head>', style + '</head>') : style + content;
                };
            
                const previewFile = fileId => {
                    const fileToDisplay = files.find(f => f.id === fileId);
                    if (fileToDisplay) {
                        const content = fileToDisplay.isChunked ? (fileToDisplay.contentChunks || []).join('') : fileToDisplay.content;
                        preview.srcdoc = injectResponsiveStyles(content);
                        document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));
                        const activeItem = document.querySelector(`.list-item[data-id="${fileToDisplay.id}"]`);
                        if (activeItem) activeItem.classList.add('active');
                    }
                };
            
                const exportSingleFile = fileId => {
                    const fileToExport = files.find(f => f.id === fileId);
                    if (!fileToExport) return;
                    const content = fileToExport.isChunked ? (fileToExport.contentChunks || []).join('') : fileToExport.content;
                    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${fileToExport.title}.html`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                };
            
                const renderPaginationInExport = (totalItems, totalPages) => {
                    const controls = [paginationControls, paginationControlsTop];
                    if (totalPages <= 1) {
                        controls.forEach(c => c.innerHTML = '');
                        return;
                    }
                    const prevDisabled = currentPage === 1 ? 'disabled' : '';
                    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
                    const paginationHTML = `<button class="page-prev px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50" ${prevDisabled}>前へ</button><span class="text-sm font-medium">${currentPage} / ${totalPages}</span><button class="page-next px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50" ${nextDisabled}>次へ</button>`;
                    controls.forEach(c => {
                        c.innerHTML = paginationHTML;
                        const prevBtn = c.querySelector('.page-prev');
                        const nextBtn = c.querySelector('.page-next');
                        if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderListInExport(); } });
                        if (nextBtn) nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderListInExport(); } });
                    });
                };
            
                const renderListInExport = () => {
                    const term = search.value.toLowerCase();
                    currentFilteredFiles = files.filter(f => {
                        const content = f.isChunked ? (f.contentChunks || []).join('') : f.content;
                        return (f.title || '').toLowerCase().includes(term) || (content || '').toLowerCase().includes(term);
                    });
            
                    currentFilteredFiles.sort((a, b) => {
                        const key = currentSort.key;
                        const order = currentSort.order === 'asc' ? 1 : -1;
                        let valA = a[key];
                        let valB = b[key];
                        if (key === 'createdAt' && valA?.seconds) {
                            valA = new Date(valA.seconds * 1000).toISOString();
                        }
                        if (key === 'createdAt' && valB?.seconds) {
                            valB = new Date(valB.seconds * 1000).toISOString();
                        }
                        valA = valA || '';
                        valB = valB || '';
                        if (valA < valB) return -1 * order;
                        if (valA > valB) return 1 * order;
                        return 0;
                    });
            
                    const totalItems = currentFilteredFiles.length;
                    const totalPages = Math.ceil(totalItems / itemsPerPage);
                    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
            
                    const paginatedItems = currentFilteredFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
            
                    listContainer.innerHTML = '';
                    itemCountEl.textContent = totalItems > 0 ? `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, totalItems)} / ${totalItems} 件` : '0 件';
            
                    const todayString = new Date().toISOString().slice(0, 10);
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayString = yesterday.toISOString().slice(0, 10);
            
                    paginatedItems.forEach(f => {
                        const div = document.createElement('div');
                        div.className = 'list-item p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100 rounded-lg border-l-4 border-transparent';
                        div.dataset.id = f.id;
            
                        let dateClass = 'text-sm text-gray-500';
                        if (f.date === todayString) { dateClass = 'text-sm text-red-600 font-bold'; } 
                        else if (f.date === yesterdayString) { dateClass = 'text-sm text-red-600'; }
            
                        div.innerHTML = `<div class="pointer-events-none pr-2 overflow-hidden flex-grow"><h3 class="font-semibold truncate" title="${escapeHtml(f.title)}">${escapeHtml(f.title)}</h3><p class="${dateClass}">${f.date || '日付未設定'}</p></div><button class="export-btn-inner flex-shrink-0 p-2 rounded-full hover:bg-gray-300" data-id="${f.id}" title="このファイルをエクスポート"><svg class="w-5 h-5 text-gray-500 hover:text-sky-600 transition-colors pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>`;
                        listContainer.appendChild(div);
                    });
            
                    renderPaginationInExport(totalItems, totalPages);
            
                    if (paginatedItems.length > 0) {
                        const currentActiveId = document.querySelector('.list-item.active')?.dataset.id;
                        if (!currentActiveId || !paginatedItems.some(f => f.id == currentActiveId)) {
                            previewFile(paginatedItems[0].id);
                        }
                    } else if (totalItems === 0) {
                        preview.srcdoc = "<div style='display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;'>記事がありません。</div>";
                    }
                };
            
                listContainer.addEventListener('click', event => {
                    const exportBtn = event.target.closest('.export-btn-inner');
                    if (exportBtn) {
                        event.stopPropagation();
                        exportSingleFile(exportBtn.dataset.id);
                        return;
                    }
                    const listItem = event.target.closest('.list-item');
                    if (listItem) {
                        previewFile(listItem.dataset.id);
                    }
                });
            
                search.addEventListener('input', () => {
                    currentPage = 1;
                    renderListInExport();
                    clearSearchBtn.classList.toggle('hidden', !search.value);
                });
                clearSearchBtn.addEventListener('click', () => {
                    search.value = '';
                    clearSearchBtn.classList.add('hidden');
                    currentPage = 1;
                    renderListInExport();
                    search.focus();
                });
            
                sortKeySelect.addEventListener('change', (e) => { currentSort.key = e.target.value; currentPage = 1; renderListInExport(); });
                sortOrderSelect.addEventListener('change', (e) => { currentSort.order = e.target.value; currentPage = 1; renderListInExport(); });
            
                renderListInExport();
            }
            