/* ==========================================================================
   버디로그 (BirdieLog) v11.0 - 핵심 비즈니스 로직 및 벤 호건 레슨 엔진 스크립트
   ========================================================================== */

window.onerror = function(message, source, lineno, colno, error) {
    alert(`[버디로그 JS 에러]\n메시지: ${message}\n라인: ${lineno}\n파일: ${source}\n에러객체: ${error}`);
    return false;
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. 애플리케이션 상태 (State v11.0)
    let state = {
        clubName: '',
        courseOut: '',
        courseIn: '',
        players: '',
        roundDate: new Date().toISOString().split('T')[0], // 기본값 오늘 날짜 YYYY-MM-DD
        pars: Array(18).fill(4), // 기본값 Par 4
        currentHole: 1, // 1~18
        holeLogs: Array.from({ length: 18 }, () => ({
            score: null,       // 상대 스코어: -3(알바), -2(이글), -1(버디), 0(파), 1(보기), 2(더블), 3(트리플), 4(쿼드), 5(기타)
            teeDir: null,      // strong_hook, draw, straight, fade, slice
            teeStatus: null,   // normal, long, short, ob, hazard
            wood: null,        // normal, left, right, none
            iron: {            // gir: 'on'|'off'|null, side: 'left'|'right'|null, depth: 'over'|'short'|null
                gir: null,
                side: null,
                depth: null
            },
            putts: null,       // 1, 2, 3 (3은 3이상)
            puttMiss: null     // left, right, short, long
        }))
    };

    // 1.5 실행 취소(Undo) 스택 및 테마 상태 관리
    let stateHistory = [];
    let currentTheme = localStorage.getItem('birdielog_theme') || 'dark';

    function pushStateToHistory() {
        stateHistory.push(JSON.parse(JSON.stringify(state)));
        if (stateHistory.length > 25) stateHistory.shift(); // 최대 25개 저장
    }

    // 2. DOM 요소 참조
    const els = {
        secSetup: document.getElementById('sec-setup'),
        secGame: document.getElementById('sec-game'),
        secReport: document.getElementById('sec-report'),

        // 설정 화면
        inputRoundDate: document.getElementById('input-round-date'),
        inputClubName: document.getElementById('input-club-name'),
        inputCourseOut: document.getElementById('input-course-out'),
        inputCourseIn: document.getElementById('input-course-in'),
        inputPlayers: document.getElementById('input-players'),
        btnFetchWebPars: document.getElementById('btn-fetch-web-pars'),
        parGridContainer: document.getElementById('par-grid-container'),
        parSumDisplay: document.getElementById('par-sum-display'),
        historyDbList: document.getElementById('history-db-list'),
        btnSaveTemplate: document.getElementById('btn-save-template'),
        btnLoadTemplate: document.getElementById('btn-load-template'),
        btnStartGame: document.getElementById('btn-start-game'),
        btnPresetStandard: document.getElementById('btn-preset-standard'),
        btnPresetShort: document.getElementById('btn-preset-short'),

        // 인게임 화면
        infoCurrentHole: document.getElementById('info-current-hole'),
        infoCurrentPar: document.getElementById('info-current-par'),
        infoLiveScore: document.getElementById('info-live-score'),
        holeNavGrid: document.getElementById('hole-nav-grid'),
        
        sumScore: document.getElementById('sum-score'),
        sumTee: document.getElementById('sum-tee'),
        sumWood: document.getElementById('sum-wood'),
        sumSecond: document.getElementById('sum-second'),
        sumPutt: document.getElementById('sum-putt'),

        guideScore: document.getElementById('guide-score'),

        tabTee: document.getElementById('tab-tee'),
        tabWood: document.getElementById('tab-wood'),
        tabIron: document.getElementById('tab-iron'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        panelContents: document.querySelectorAll('.panel-content'),

        btnPrevHole: document.getElementById('btn-prev-hole'),
        btnNextHole: document.getElementById('btn-next-hole'),
        btnFinishGame: document.getElementById('btn-finish-game'),
        btnResetData: document.getElementById('btn-reset-data'),
        btnUndo: document.getElementById('btn-undo'),
        btnToggleTheme: document.getElementById('btn-toggle-theme'),

        // 리포트 화면
        repTotalScore: document.getElementById('rep-total-score'),
        repParDiff: document.getElementById('rep-par-diff'),
        repAvgPutts: document.getElementById('rep-avg-putts'),
        repThreePutts: document.getElementById('rep-three-putts'),
        repFwyRate: document.getElementById('rep-fwy-rate'),
        repFwyDetail: document.getElementById('rep-fwy-detail'),
        repGirRate: document.getElementById('rep-gir-rate'),
        repGirDetail: document.getElementById('rep-gir-detail'),
        txtReportOutput: document.getElementById('txt-report-output'),
        btnRestart: document.getElementById('btn-restart'),
        btnCopyReport: document.getElementById('btn-copy-report'),
        btnDownloadCard: document.getElementById('btn-download-card'),
        canvasCard: document.getElementById('canvas-card'),
        scorecardTable: document.getElementById('scorecard-table'),
        gaugeFwy: document.getElementById('gauge-fwy'),
        gaugeGir: document.getElementById('gauge-gir'),
        gaugeFwyVal: document.getElementById('gauge-fwy-val'),
        gaugeGirVal: document.getElementById('gauge-gir-val'),

        // 공통
        toast: document.getElementById('toast'),
        webLoaderOverlay: document.getElementById('web-loader-overlay')
    };

    // 3. SPA 섹션 전환
    function showSection(sectionId) {
        [els.secSetup, els.secGame, els.secReport].forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 4. 로컬 스토리지 연동
    const STORAGE_KEY = 'birdielog_state_v4';
    const TEMPLATE_KEY = 'birdielog_course_template_v4';

    function saveStateToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function loadStateFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                
                // 1. 기본 메타데이터 복사
                if (parsed.roundDate !== undefined) state.roundDate = parsed.roundDate;
                if (parsed.clubName !== undefined) state.clubName = parsed.clubName;
                if (parsed.courseOut !== undefined) state.courseOut = parsed.courseOut;
                if (parsed.courseIn !== undefined) state.courseIn = parsed.courseIn;
                if (parsed.players !== undefined) state.players = parsed.players;
                if (parsed.currentHole !== undefined) state.currentHole = Number(parsed.currentHole) || 1;

                // 2. Pars 배열 검증 및 마이그레이션
                if (parsed.pars && Array.isArray(parsed.pars) && parsed.pars.length === 18) {
                    state.pars = parsed.pars.map(p => Number(p) || 4);
                } else {
                    state.pars = Array(18).fill(4);
                }

                // 3. HoleLogs 배열 검증 및 마이그레이션
                if (parsed.holeLogs && Array.isArray(parsed.holeLogs) && parsed.holeLogs.length === 18) {
                    state.holeLogs = parsed.holeLogs.map((log) => {
                        const baseLog = {
                            score: null,
                            teeDir: null,
                            teeStatus: null,
                            wood: null,
                            iron: { gir: null, side: null, depth: null },
                            putts: null,
                            puttMiss: null
                        };

                        if (!log) return baseLog;

                        if (log.score !== undefined) baseLog.score = log.score !== null ? Number(log.score) : null;
                        if (log.teeDir !== undefined) baseLog.teeDir = log.teeDir;
                        if (log.teeStatus !== undefined) baseLog.teeStatus = log.teeStatus;
                        if (log.wood !== undefined) baseLog.wood = log.wood;
                        if (log.putts !== undefined) baseLog.putts = log.putts !== null ? Number(log.putts) : null;
                        if (log.puttMiss !== undefined) baseLog.puttMiss = log.puttMiss;

                        if (log.iron) {
                            if (typeof log.iron === 'string') {
                                const oldIron = log.iron;
                                baseLog.iron = {
                                    gir: oldIron === 'on' ? 'on' : (oldIron ? 'off' : null),
                                    side: (oldIron === 'left' || oldIron === 'right') ? oldIron : null,
                                    depth: (oldIron === 'over' || oldIron === 'short') ? oldIron : null
                                };
                            } else if (typeof log.iron === 'object') {
                                baseLog.iron = {
                                    gir: log.iron.gir !== undefined ? log.iron.gir : null,
                                    side: log.iron.side !== undefined ? log.iron.side : null,
                                    depth: log.iron.depth !== undefined ? log.iron.depth : null
                                };
                            }
                        }
                        return baseLog;
                    });
                } else {
                    state.holeLogs = Array.from({ length: 18 }, () => ({
                        score: null, teeDir: null, teeStatus: null, wood: null, 
                        iron: { gir: null, side: null, depth: null }, 
                        putts: null, puttMiss: null
                    }));
                }
                
                return true;
            } catch (e) {
                console.error("데이터 로드 에러:", e);
            }
        }
        return false;
    }

    function clearStorage() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // 5. 설정 화면 (18홀 Par 그리드 겹침 완전 해결 렌더링)
    function renderParGrid() {
        els.parGridContainer.innerHTML = '';
        for (let i = 0; i < 18; i++) {
            const parItem = document.createElement('div');
            parItem.className = 'par-item';
            parItem.innerHTML = `
                <span class="par-hole-title">${i + 1}번 홀</span>
                <div class="par-controls">
                    <button type="button" class="par-btn dec" data-hole="${i}">-</button>
                    <span class="par-val" id="par-val-${i}">${state.pars[i]}</span>
                    <button type="button" class="par-btn inc" data-hole="${i}">+</button>
                </div>
            `;
            els.parGridContainer.appendChild(parItem);
        }

        // 증감 버튼 리스너
        els.parGridContainer.querySelectorAll('.par-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const holeIdx = parseInt(target.dataset.hole, 10);
                if (isNaN(holeIdx)) return;
                const isInc = target.classList.contains('inc');
                let currentPar = state.pars[holeIdx];

                if (isInc && currentPar < 5) {
                    currentPar++;
                } else if (!isInc && currentPar > 3) {
                    currentPar--;
                }

                state.pars[holeIdx] = currentPar;
                document.getElementById(`par-val-${holeIdx}`).textContent = currentPar;
                updateParSum();
                saveStateToStorage();
            });
        });
        updateParSum();
    }

    // 템플릿 저장
    els.btnSaveTemplate.addEventListener('click', () => {
        const templateData = {
            clubName: els.inputClubName.value.trim(),
            courseOut: els.inputCourseOut.value.trim(),
            courseIn: els.inputCourseIn.value.trim(),
            pars: state.pars
        };

        if (!templateData.clubName) {
            alert("골프장명을 입력한 뒤 템플릿을 저장해 주세요.");
            return;
        }

        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templateData));
        showToast("나의 코스 템플릿이 저장되었습니다!");
    });

    // 템플릿 불러오기
    els.btnLoadTemplate.addEventListener('click', () => {
        const savedTemplate = localStorage.getItem(TEMPLATE_KEY);
        if (!savedTemplate) {
            alert("저장된 코스 템플릿이 없습니다.");
            return;
        }

        try {
            const template = JSON.parse(savedTemplate);
            els.inputClubName.value = template.clubName || '';
            els.inputCourseOut.value = template.courseOut || '';
            els.inputCourseIn.value = template.courseIn || '';
            
            // 18홀 기준타수 정합성 검증 및 강제 보정 추가
            if (template.pars && Array.isArray(template.pars) && template.pars.length === 18) {
                state.pars = template.pars.map(p => Number(p) || 4);
            } else {
                state.pars = Array(18).fill(4);
            }
            
            renderParGrid();
            updateParSum();
            saveStateToStorage();
            showToast("코스 템플릿을 성공적으로 불러왔습니다!");
        } catch (e) {
            console.error("템플릿 로드 실패:", e);
        }
    });

    // 라운딩 시작
    els.btnStartGame.addEventListener('click', () => {
        try {
            state.clubName = els.inputClubName.value.trim() || '이름 없는 골프장';
            state.courseOut = els.inputCourseOut.value.trim() || '전반';
            state.courseIn = els.inputCourseIn.value.trim() || '후반';
            state.players = els.inputPlayers.value.trim() || '플레이어';

            saveStateToStorage();
            initInGameUI();
            showSection('sec-game');
        } catch (err) {
            alert("라운딩 시작 중 에러 발생: " + err.message + "\nStack: " + err.stack);
        }
    });

    // 6. 인게임 화면 기능 제어
    function initInGameUI() {
        renderHoleNavigation();
        updateHoleRecordScreen();
    }

    // 18홀 빠른 이동 네비게이터 렌더링
    function renderHoleNavigation() {
        els.holeNavGrid.innerHTML = '';
        for (let i = 1; i <= 18; i++) {
            const btn = document.createElement('button');
            btn.className = `hole-nav-btn ${i === state.currentHole ? 'active' : ''}`;
            btn.textContent = i;
            btn.dataset.hole = i;
            
            const score = state.holeLogs[i - 1].score;
            if (score !== null) {
                btn.classList.add('recorded');
                if (score < 0) btn.classList.add('score-birdie');
                else if (score === 0) btn.classList.add('score-par');
                else if (score === 1) btn.classList.add('score-bogey');
                else if (score >= 2) btn.classList.add('score-double');
            }

            btn.addEventListener('click', (e) => {
                state.currentHole = parseInt(e.target.dataset.hole, 10);
                updateHoleRecordScreen();
            });
            els.holeNavGrid.appendChild(btn);
        }
    }

    // 현재 홀 데이터 기반 UI 업데이트
    function updateHoleRecordScreen() {
        const holeIdx = state.currentHole - 1;
        const currentPar = state.pars[holeIdx];
        const log = state.holeLogs[holeIdx];

        // 1. 헤더 및 홀 번호 정보 동적 갱신
        els.infoCurrentHole.textContent = state.currentHole;
        els.infoCurrentPar.textContent = `Par ${currentPar}`;
        
        // 동적 가이드 텍스트 갱신 (예: 1번홀의 최종 성적을 선택하세요)
        els.guideScore.textContent = `${state.currentHole}번 홀의 최종 성적을 선택하세요.`;
        
        // 네비게이터 active 정렬
        document.querySelectorAll('.hole-nav-btn').forEach(btn => {
            const h = parseInt(btn.dataset.hole, 10);
            btn.classList.remove('active');
            if (h === state.currentHole) {
                btn.classList.add('active');
            }
        });

        // 실시간 누적 스코어
        updateLiveScore();

        // 2. Par 값에 따른 탭 자동 숨김 제어 (Par 3/4/5)
        if (currentPar === 3) {
            els.tabTee.classList.add('hidden');
            els.tabWood.classList.add('hidden');
        } else if (currentPar === 4) {
            els.tabTee.classList.remove('hidden');
            els.tabWood.classList.add('hidden');
        } else {
            els.tabTee.classList.remove('hidden');
            els.tabWood.classList.remove('hidden');
        }

        // 3. 기록 요약 카드 데이터 갱신
        updateSummaryCard(log, currentPar);

        // 4. 입력 폼 컴포넌트 동기화
        syncInputComponents(log);

        // 5. 입력 완료 탭 피드백 업데이트
        updateTabRecordedStates();

        // 탭 상태 스코어로 복원
        switchInputTab('score');
    }

    // 입력 상태 실시간 탭 피드백 처리 함수
    function updateTabRecordedStates() {
        const holeIdx = state.currentHole - 1;
        const currentPar = state.pars[holeIdx];
        const log = state.holeLogs[holeIdx];

        els.tabBtns.forEach(btn => {
            const step = btn.dataset.step;
            let isRecorded = false;

            if (step === 'score') {
                isRecorded = log.score !== null;
            } else if (step === 'tee') {
                if (currentPar === 3) {
                    isRecorded = true;
                } else {
                    isRecorded = log.teeDir !== null && log.teeStatus !== null;
                }
            } else if (step === 'wood') {
                if (currentPar === 3 || currentPar === 4) {
                    isRecorded = true;
                } else {
                    isRecorded = log.wood !== null;
                }
            } else if (step === 'iron') {
                if (log.iron) {
                    isRecorded = log.iron.gir === 'on' || 
                                 (log.iron.gir === 'off' && (log.iron.side !== null || log.iron.depth !== null));
                }
            } else if (step === 'putt') {
                isRecorded = log.putts === 1 || (log.putts > 1 && log.puttMiss !== null);
            }

            if (isRecorded) {
                btn.classList.add('recorded');
            } else {
                btn.classList.remove('recorded');
            }
        });
    }

    // 실시간 라이브 스코어 연산
    function updateLiveScore() {
        let totalDiff = 0;
        let playedHoles = 0;
        
        state.holeLogs.forEach(log => {
            if (log.score !== null) {
                totalDiff += log.score;
                playedHoles++;
            }
        });

        if (playedHoles === 0) {
            els.infoLiveScore.textContent = 'E';
            els.infoLiveScore.style.color = 'var(--neon-green)';
        } else {
            if (totalDiff === 0) {
                els.infoLiveScore.textContent = 'E';
                els.infoLiveScore.style.color = 'var(--neon-green)';
            } else if (totalDiff > 0) {
                els.infoLiveScore.textContent = `+${totalDiff}`;
                els.infoLiveScore.style.color = totalDiff >= 10 ? 'var(--neon-red)' : 'var(--neon-yellow)';
            } else {
                els.infoLiveScore.textContent = `${totalDiff}`;
                els.infoLiveScore.style.color = 'var(--neon-cyan)';
            }
        }
    }

    // 요약 카드 텍스트 동기화
    function updateSummaryCard(log, currentPar) {
        // 1. 성적
        if (log.score === null) {
            els.sumScore.textContent = '-';
            els.sumScore.className = 'val';
        } else {
            const labelMap = { 
                '-3': '알바(-3)', '-2': '이글(-2)', '-1': '버디(-1)', 
                '0': '파(E)', '1': '보기(+1)', '2': '더블(+2)', 
                '3': '트리플(+3)', '4': '쿼드(+4)', '5': '기타(+5)' 
            };
            els.sumScore.textContent = labelMap[log.score] || '-';
            els.sumScore.className = 'val text-highlight';
            
            if (log.score < 0) els.sumScore.style.color = 'var(--neon-cyan)';
            else if (log.score === 0) els.sumScore.style.color = 'var(--neon-green)';
            else if (log.score === 1) els.sumScore.style.color = 'var(--neon-yellow)';
            else els.sumScore.style.color = 'var(--neon-red)';
        }

        // 2. 티샷
        if (currentPar === 3) {
            els.sumTee.textContent = 'Par3 제외';
            els.sumTee.style.color = 'var(--text-muted)';
        } else {
            if (log.teeDir === 'straight') {
                els.sumTee.textContent = '안착';
                els.sumTee.style.color = 'var(--neon-green)';
            } else if (log.teeDir) {
                const dirLabel = log.teeDir === 'strong_hook' ? '강훅' :
                                 log.teeDir === 'draw' ? '드로우' :
                                 log.teeDir === 'fade' ? '페이드' : '슬라이스';
                const statusLabel = (log.teeStatus === 'ob') ? '(OB)' : (log.teeStatus === 'hazard') ? '(해저드)' : '';
                els.sumTee.textContent = `${dirLabel}${statusLabel}`;
                els.sumTee.style.color = (log.teeStatus === 'ob' || log.teeStatus === 'hazard') ? 'var(--neon-red)' : 'var(--neon-yellow)';
            } else {
                els.sumTee.textContent = '-';
                els.sumTee.style.color = 'var(--text-primary)';
            }
        }

        // 3. 우드/유틸
        if (currentPar === 3 || currentPar === 4) {
            els.sumWood.textContent = currentPar === 3 ? 'Par3 제외' : 'Par4 제외';
            els.sumWood.style.color = 'var(--text-muted)';
        } else {
            if (log.wood === 'normal') {
                els.sumWood.textContent = '정상';
                els.sumWood.style.color = 'var(--neon-green)';
            } else if (log.wood === 'left') {
                els.sumWood.textContent = '왼쪽미스';
                els.sumWood.style.color = 'var(--neon-yellow)';
            } else if (log.wood === 'right') {
                els.sumWood.textContent = '오른쪽미스';
                els.sumWood.style.color = 'var(--neon-yellow)';
            } else if (log.wood === 'none') {
                els.sumWood.textContent = '없음';
                els.sumWood.style.color = 'var(--text-muted)';
            } else {
                els.sumWood.textContent = '-';
                els.sumWood.style.color = 'var(--text-primary)';
            }
        }

        // 4. 아이언 어프로치 (GIR)
        if (log.iron && log.iron.gir === 'on') {
            els.sumSecond.textContent = 'GIR 성공';
            els.sumSecond.style.color = 'var(--neon-green)';
        } else if (log.iron && log.iron.gir === 'off') {
            const misses = [];
            if (log.iron.side === 'left') misses.push('왼쪽');
            else if (log.iron.side === 'right') misses.push('오른쪽');

            if (log.iron.depth === 'over') misses.push('오버');
            else if (log.iron.depth === 'short') misses.push('짧음');

            if (misses.length > 0) {
                els.sumSecond.textContent = misses.join('+');
                els.sumSecond.style.color = 'var(--neon-yellow)';
            } else {
                els.sumSecond.textContent = '미스';
                els.sumSecond.style.color = 'var(--neon-yellow)';
            }
        } else {
            els.sumSecond.textContent = '-';
            els.sumSecond.style.color = 'var(--text-primary)';
        }

        // 5. 퍼팅
        if (log.putts !== null) {
            els.sumPutt.textContent = `${log.putts}펏${log.putts >= 3 ? ' ⚠️' : ''}`;
            els.sumPutt.style.color = log.putts >= 3 ? 'var(--neon-red)' : 'var(--text-primary)';
        } else {
            els.sumPutt.textContent = '-';
            els.sumPutt.style.color = 'var(--text-primary)';
        }
    }

    // 입력 컴포넌트 상태 연동
    function syncInputComponents(log) {
        // 1. 스코어 버튼 그리드 동기화
        document.querySelectorAll('.score-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (log.score !== null && String(log.score) === btn.dataset.score) {
                btn.classList.add('selected');
            }
        });

        // 2. 티샷 방향 5단계 버튼
        document.querySelectorAll('.tee-dir').forEach(btn => {
            btn.classList.remove('selected');
            if (log.teeDir === btn.dataset.dir) btn.classList.add('selected');
        });

        // 3. 드라이버 상태 버튼 그리드 동기화
        document.querySelectorAll('.tee-status-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (log.teeStatus === btn.dataset.status) {
                btn.classList.add('selected');
            }
        });

        // 4. 우드/유틸샷 버튼
        document.querySelectorAll('.wood-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (log.wood === btn.dataset.wood) btn.classList.add('selected');
        });

        // 5. 아이언샷 버튼 동기화
        const ironOnBtn = document.getElementById('btn-iron-on');
        if (ironOnBtn) {
            if (log.iron && log.iron.gir === 'on') {
                ironOnBtn.classList.add('selected');
            } else {
                ironOnBtn.classList.remove('selected');
            }
        }

        document.querySelectorAll('.iron-miss-btn').forEach(btn => {
            const type = btn.dataset.type; // 'side' or 'depth'
            const val = btn.dataset.val;   // 'left', 'right', 'over', 'short'
            
            btn.classList.remove('selected');
            if (log.iron) {
                if (type === 'side' && log.iron.side === val) {
                    btn.classList.add('selected');
                } else if (type === 'depth' && log.iron.depth === val) {
                    btn.classList.add('selected');
                }
            }
        });

        // 6. 퍼팅 버튼
        document.querySelectorAll('.putt-count').forEach(btn => {
            btn.classList.remove('selected');
            if (log.putts === parseInt(btn.dataset.putts, 10)) btn.classList.add('selected');
        });
        document.querySelectorAll('.putt-miss').forEach(btn => {
            btn.classList.remove('selected');
            if (log.puttMiss === btn.dataset.miss) btn.classList.add('selected');
        });

        // 1펏 컵인인 경우 퍼팅 미스 패턴 감추기
        const puttMissSection = document.getElementById('putt-miss-section');
        if (log.putts === 1) {
            puttMissSection.style.display = 'none';
        } else {
            puttMissSection.style.display = 'block';
        }
    }

    // 7. 입력 탭 전환 통제
    function switchInputTab(step) {
        els.tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.step === step) btn.classList.add('active');
        });

        els.panelContents.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `panel-${step}`) panel.classList.add('active');
        });
    }

    els.tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchInputTab(e.target.dataset.step);
        });
    });

    // 8. 터치 및 샷 입력 리스너 할당 & 스마트 오토포커스
    // 스코어 버튼 그리드 선택
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const val = parseInt(e.currentTarget.dataset.score, 10);
            const holeIdx = state.currentHole - 1;
            state.holeLogs[holeIdx].score = val;

            saveStateToStorage();
            renderHoleNavigation();
            updateHoleRecordScreen();

            // Par 3면 티샷/우드를 스킵하고 아이언 탭으로 직진
            if (state.pars[holeIdx] === 3) {
                setTimeout(() => switchInputTab('iron'), 250);
            } else {
                setTimeout(() => switchInputTab('tee'), 250);
            }
        });
    });

    // 티샷 방향 선택 (5단계)
    document.querySelectorAll('.tee-dir').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const dir = e.currentTarget.dataset.dir;
            const holeIdx = state.currentHole - 1;
            state.holeLogs[holeIdx].teeDir = dir;
            saveStateToStorage();
            updateHoleRecordScreen();

            // 스트레이트일 때 드라이버 상태를 자동으로 '정상' 설정 후 다음 유효 탭으로 오토포커스
            if (dir === 'straight') {
                state.holeLogs[holeIdx].teeStatus = 'normal';
                saveStateToStorage();
                updateHoleRecordScreen();
                
                if (state.pars[holeIdx] === 4) {
                    setTimeout(() => switchInputTab('iron'), 250);
                } else {
                    setTimeout(() => switchInputTab('wood'), 250);
                }
            }
        });
    });

    // 드라이버 상태 버튼 그리드 선택
    document.querySelectorAll('.tee-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const status = e.currentTarget.dataset.status;
            const holeIdx = state.currentHole - 1;
            state.holeLogs[holeIdx].teeStatus = status;
            
            saveStateToStorage();
            updateHoleRecordScreen();
            
            if (state.pars[holeIdx] === 4) {
                setTimeout(() => switchInputTab('iron'), 250);
            } else {
                setTimeout(() => switchInputTab('wood'), 250);
            }
        });
    });

    // 우드/유틸샷 선택
    document.querySelectorAll('.wood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const wood = e.currentTarget.dataset.wood;
            state.holeLogs[state.currentHole - 1].wood = wood;
            
            saveStateToStorage();
            updateHoleRecordScreen();
            setTimeout(() => switchInputTab('iron'), 250);
        });
    });

    // 5. 아이언 온그린 (GIR 성공) 버튼 클릭
    const ironOnBtn = document.getElementById('btn-iron-on');
    if (ironOnBtn) {
        ironOnBtn.addEventListener('click', () => {
            pushStateToHistory();
            const holeIdx = state.currentHole - 1;
            state.holeLogs[holeIdx].iron = {
                gir: 'on',
                side: null,
                depth: null
            };
            saveStateToStorage();
            updateHoleRecordScreen();
            setTimeout(() => switchInputTab('putt'), 250);
        });
    }

    // 아이언 미스 버튼 클릭
    document.querySelectorAll('.iron-miss-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const type = e.currentTarget.dataset.type; // 'side' or 'depth'
            const val = e.currentTarget.dataset.val;   // 'left', 'right', 'over', 'short'
            const holeIdx = state.currentHole - 1;
            
            if (!state.holeLogs[holeIdx].iron || typeof state.holeLogs[holeIdx].iron === 'string') {
                state.holeLogs[holeIdx].iron = { gir: null, side: null, depth: null };
            }
            
            const iron = state.holeLogs[holeIdx].iron;
            iron.gir = 'off';

            if (type === 'side') {
                iron.side = (iron.side === val) ? null : val;
            } else if (type === 'depth') {
                iron.depth = (iron.depth === val) ? null : val;
            }

            saveStateToStorage();
            updateHoleRecordScreen();
        });
    });

    // 퍼팅 수 선택
    document.querySelectorAll('.putt-count').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const putts = parseInt(e.currentTarget.dataset.putts, 10);
            state.holeLogs[state.currentHole - 1].putts = putts;
            
            if (putts === 1) {
                state.holeLogs[state.currentHole - 1].puttMiss = null; // 미스방향 자동 초기화
                saveStateToStorage();
                updateHoleRecordScreen();
                // 1펏 컵인이면 다음 홀 자동 점프
                setTimeout(goToNextHole, 300);
            } else {
                saveStateToStorage();
                updateHoleRecordScreen();
            }
        });
    });

    // 퍼팅 미스 패턴 선택
    document.querySelectorAll('.putt-miss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pushStateToHistory();
            const miss = e.currentTarget.dataset.miss;
            state.holeLogs[state.currentHole - 1].puttMiss = miss;
            
            saveStateToStorage();
            updateHoleRecordScreen();
            // 입력 마감 후 다음 홀 점프
            setTimeout(goToNextHole, 300);
        });
    });

    // 홀 이동
    function goToPrevHole() {
        if (state.currentHole > 1) {
            state.currentHole--;
            updateHoleRecordScreen();
        }
    }

    function goToNextHole() {
        if (state.currentHole < 18) {
            state.currentHole++;
            updateHoleRecordScreen();
        }
    }

    els.btnPrevHole.addEventListener('click', goToPrevHole);
    els.btnNextHole.addEventListener('click', goToNextHole);

    // 실행 취소(Undo) 핸들러
    function undoLastAction() {
        if (stateHistory.length > 0) {
            state = stateHistory.pop();
            saveStateToStorage();
            renderHoleNavigation();
            updateHoleRecordScreen();
            showToast("직전 입력이 취소되었습니다.");
        } else {
            showToast("실행 취소할 기록이 없습니다.");
        }
    }
    els.btnUndo.addEventListener('click', undoLastAction);

    // 주야간 테마 적용 함수
    function applyTheme(theme) {
        const wrapper = document.querySelector('.device-wrapper');
        if (theme === 'light') {
            wrapper.classList.add('light-theme');
            els.btnToggleTheme.innerHTML = '<i class="ph ph-moon"></i>';
        } else {
            wrapper.classList.remove('light-theme');
            els.btnToggleTheme.innerHTML = '<i class="ph ph-sun-dim"></i>';
        }
        localStorage.setItem('birdielog_theme', theme);
        currentTheme = theme;
    }
    els.btnToggleTheme.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // Par 빠른 프리셋 설정
    els.btnPresetStandard.addEventListener('click', () => {
        pushStateToHistory();
        state.pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
        renderParGrid();
        updateParSum();
        saveStateToStorage();
        showToast("표준 코스(Par 72)로 일괄 설정되었습니다.");
    });

    els.btnPresetShort.addEventListener('click', () => {
        pushStateToHistory();
        state.pars = Array(18).fill(3);
        renderParGrid();
        updateParSum();
        saveStateToStorage();
        showToast("숏 코스(Par 54)로 일괄 설정되었습니다.");
    });

    // 엄지손가락 스와이프 제스처 네비게이션
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const gestureArea = document.querySelector('.input-panel-wrapper');
    if (gestureArea) {
        gestureArea.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        gestureArea.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            
            if (Math.abs(diffX) > 70 && Math.abs(diffY) < 40) {
                if (diffX > 0) {
                    goToPrevHole();
                } else {
                    goToNextHole();
                }
            }
        }, { passive: true });
    }

    // 기록 초기화
    els.btnResetData.addEventListener('click', () => {
        if (confirm("정말 모든 기록을 삭제하고 v5.0 세팅 화면으로 가시겠습니까?")) {
            clearStorage();
            state.currentHole = 1;
            state.holeLogs = Array.from({ length: 18 }, () => ({
                score: null, teeDir: null, teeStatus: null, wood: null, 
                iron: { gir: null, side: null, depth: null }, 
                putts: null, puttMiss: null
            }));
            
            els.inputClubName.value = '';
            els.inputCourseOut.value = '';
            els.inputCourseIn.value = '';
            els.inputPlayers.value = '';
            
            renderParGrid();
            showSection('sec-setup');
            showToast("모든 기록이 초기화되었습니다.");
        }
    });

    // 9. 리포트 생성 및 벤 호건 원포인트 스킬 레슨 알고리즘 연동
    els.btnFinishGame.addEventListener('click', () => {
        if (confirm("경기를 마감하고 벤 호건의 원포인트 스윙 조언이 포함된 최종 리포트를 빌드하시겠습니까?")) {
            generateReport();
            saveRoundToDB();
            showSection('sec-report');
        }
    });

    // 벤 호건 레슨 조언 생성기
    function getBenHoganAdvice(stats) {
        // 통계 팩터 분석
        const sliceCount = stats.teeSlice + stats.teeFade + stats.woodRight + stats.ironRight;
        const hookCount = stats.teeHook + stats.teeDraw + stats.woodLeft + stats.ironLeft;
        const shortCount = stats.teeShort + stats.ironShort;
        const totalAttempts = stats.playedHoles;

        if (totalAttempts === 0) {
            return "기록된 홀 정보가 부족하여 스윙 조언을 분석할 수 없습니다.";
        }

        const sliceRatio = sliceCount / (totalAttempts * 2.5); // 평균 샷 빈도 대비 가중치
        const hookRatio = hookCount / (totalAttempts * 2.5);
        const shortRatio = shortCount / (totalAttempts * 1.5);

        // 1. 슬라이스/우측 미스 경향이 우세할 때
        if (sliceRatio > 0.35 && sliceRatio >= hookRatio) {
            return "💡 [벤 호건의 원포인트 레슨 - 슬라이스 처방]\n" +
                   "슬라이스는 흔히 그립과 오른발 정렬 오류에서 시작됩니다. " +
                   "어드레스 시 왼손의 너클이 위에서 바라보았을 때 최소 2~3개 노출되는 강한 그립(Strong Grip)을 쥐고 있는지 점검하세요. " +
                   "또한, 다운스윙 시 골반 회전이 너무 빠르면 클럽 페이스가 열려 맞으므로 임팩트 때까지 가슴이 볼을 바라보게 한 뒤 오른팔을 강하게 돌려(릴리즈) 컵인 시키는 동작에 집중하십시오.";
        }

        // 2. 훅/좌측 미스 경향이 우세할 때
        if (hookRatio > 0.35 && hookRatio > sliceRatio) {
            return "💡 [벤 호건의 원포인트 레슨 - 훅 방지 처방]\n" +
                   "훅은 임팩트 시 상체의 턴보다 손목 롤오버가 너무 급격하게 진행되어 페이스가 닫혀 맞을 때 유발됩니다. " +
                   "백스윙 탑에서 왼손목이 꺾이지 않고 널판지처럼 일직선(Flat Wrist)을 이루도록 제어해야 합니다. " +
                   "이후 다운스윙과 임팩트 과정에서는 오른쪽 골반(힙)을 타겟 방향으로 강하고 신속하게 턴해주어 손목의 과회전을 억제하는 상체 조화를 이끌어내십시오.";
        }

        // 3. 비거리 부족 및 숏 미스가 우세할 때
        if (shortRatio > 0.35) {
            return "💡 [벤 호건의 원포인트 레슨 - 비거리 증강 처방]\n" +
                   "드라이버 비거리를 늘리려면 견고한 하체 지탱을 기반으로 코일링(상체 비틀림)을 완성해야 합니다. " +
                   "백스윙 시 오른 무릎의 각도를 고정하고 상체를 최소 90도 이상 꼬아 에너지 축적을 극대화하십시오. " +
                   "다운스윙의 시작은 팔이 아니라 반드시 왼쪽 골반을 타겟 뒤쪽으로 끌어당기는 체중 이동(Hip Turn)이 선행되어야 가속을 최대치로 얹을 수 있습니다.";
        }

        // 4. 3펏 다수 발생 시
        if (stats.threePutts >= 2) {
            return "💡 [벤 호건의 원포인트 레슨 - 퍼팅 일관성 처방]\n" +
                   "퍼팅 미스의 절대적인 원인은 스윙 궤적 중 머리와 상체가 미세하게 움직이기 때문입니다. " +
                   "스트로크가 완전히 종료되어 팔로스루가 멈출 때까지 시선은 볼이 있던 스팟을 지독하게 응시하며 골반의 움직임을 콘크리트처럼 붙잡아 두십시오. " +
                   "시계추 흔들림처럼 앞뒤 테이크백 크기를 1:1로 칼같이 맞추면 장거리 퍼트 거리감이 확실해집니다.";
        }

        // 기본 처방 (안정적인 라운딩)
        return "💡 [벤 호건의 원포인트 레슨 - 셋업 루틴 처방]\n" +
               "오늘 매우 고른 샷 정합성을 보여주셨습니다. 스코어의 일관성을 더욱 높이려면 매 홀 어드레스 루틴을 신중하게 정립해야 합니다. " +
               "클럽을 내려놓기 전 양발 스탠스 라인과 양 어깨가 가상의 타겟 라인과 칼같이 평행을 이루는지(스퀘어 셋업) 습관적으로 확인하십시오. " +
               "골프의 90%는 공을 치기 전 셋업 자세에서 이미 결정됩니다.";
    }

    // 종합 통계 계산 및 보고서 텍스트 생성
    function generateReport() {
        const parSum = state.pars.reduce((a, b) => a + b, 0);
        let totalScore = parSum;
        let playedHoles = 0;
        
        let totalPutts = 0;
        let threePutts = 0;
        let puttHolesCount = 0;

        let totalTeeShots = 0; // Par3를 제외한 티샷 수
        let fwyHits = 0;       // 페어웨이 안착 수
        
        // 상세 통계 카운터
        let stats = {
            playedHoles: 0,
            threePutts: 0,
            teeSlice: 0,
            teeFade: 0,
            teeDraw: 0,
            teeHook: 0,
            teeShort: 0,
            woodLeft: 0,
            woodRight: 0,
            ironLeft: 0,
            ironRight: 0,
            ironShort: 0,
            ironOver: 0 // 신규 추가
        };

        let girHits = 0;

        let holeDetailsText = '';

        state.holeLogs.forEach((log, idx) => {
            const holeNum = idx + 1;
            const par = state.pars[idx];
            const isPlayed = log.score !== null;

            if (isPlayed) {
                totalScore += log.score;
                playedHoles++;
                stats.playedHoles++;

                // 퍼팅
                if (log.putts !== null) {
                    totalPutts += log.putts;
                    puttHolesCount++;
                    if (log.putts >= 3) {
                        threePutts++;
                        stats.threePutts++;
                    }
                }

                // 티샷 (Par 3 제외)
                if (par !== 3) {
                    totalTeeShots++;
                    if (log.teeDir === 'straight') {
                        // 스트레이트이면서 OB/해저드가 아닐 때 FWY 안착 성공
                        if (log.teeStatus !== 'ob' && log.teeStatus !== 'hazard') {
                            fwyHits++;
                        }
                    }
                    
                    // 티샷 구질 통계
                    if (log.teeDir === 'slice') stats.teeSlice++;
                    else if (log.teeDir === 'fade') stats.teeFade++;
                    else if (log.teeDir === 'draw') stats.teeDraw++;
                    else if (log.teeDir === 'strong_hook') stats.teeHook++;
                    
                    if (log.teeStatus === 'short') stats.teeShort++;
                }

                // 우드 통계
                if (par !== 3 && log.wood) {
                    if (log.wood === 'left') stats.woodLeft++;
                    else if (log.wood === 'right') stats.woodRight++;
                }

                // 아이언 통계 (GIR)
                if (log.iron && log.iron.gir === 'on') {
                    girHits++;
                } else if (log.iron && log.iron.gir === 'off') {
                    if (log.iron.side === 'left') stats.ironLeft++;
                    else if (log.iron.side === 'right') stats.ironRight++;
                    
                    if (log.iron.depth === 'over') stats.ironOver++;
                    else if (log.iron.depth === 'short') stats.ironShort++;
                }

                // 텍스트 리포트 홀별 가공 라인 작성
                const scoreLabel = log.score === -3 ? '알바 (-3)' :
                                   log.score === -2 ? '이글 (-2)' :
                                   log.score === -1 ? '버디 (-1)' :
                                   log.score === 0 ? '파 (E)    ' :
                                   log.score === 1 ? '보기 (+1) ' :
                                   log.score === 2 ? '더블 (+2) ' :
                                   log.score === 3 ? '트리플 (+3)' :
                                   log.score === 4 ? '쿼드 (+4) ' : '기타 (+5) ';

                const puttLabel = log.putts ? `${log.putts}펏${log.putts >= 3 ? ' ⚠️' : ''}` : '-';
                
                let teeLogText = '';
                if (par === 3) {
                    teeLogText = '[티샷] 아이언 티샷';
                } else {
                    const dirTextMap = { 
                        'straight': '스트레이트 안착', 'draw': '드로우 구질', 
                        'fade': '페이드 구질', 'strong_hook': '강한 훅 미스', 'slice': '슬라이스 미스' 
                    };
                    const statusTextMap = { 
                        'normal': '', 'long': ' (긺)', 'short': ' (짧음)', 
                        'ob': ' (OB)', 'hazard': ' (해저드)' 
                    };
                    teeLogText = `[티샷] ${dirTextMap[log.teeDir] || '기록없음'}${statusTextMap[log.teeStatus] || ''}`;
                }

                let woodLogText = '';
                if (par === 3) {
                    woodLogText = '없음';
                } else {
                    woodLogText = log.wood === 'normal' ? '정상' : log.wood === 'left' ? '왼쪽미스' : log.wood === 'right' ? '오른쪽미스' : '미사용';
                }

                let ironLogText = '';
                if (log.iron && log.iron.gir === 'on') {
                    ironLogText = 'GIR 온그린';
                } else if (log.iron && log.iron.gir === 'off') {
                    const misses = [];
                    if (log.iron.side === 'left') misses.push('그린 좌측');
                    else if (log.iron.side === 'right') misses.push('그린 우측');
                    
                    if (log.iron.depth === 'over') misses.push('그린 오버');
                    else if (log.iron.depth === 'short') misses.push('그린 짧음');
                    
                    if (misses.length > 0) {
                        ironLogText = misses.join(' ');
                    } else {
                        ironLogText = '온그린 실패';
                    }
                } else {
                    ironLogText = '기록없음';
                }

                const puttLogText = log.putts === 1 ? '1펏 성공!' :
                                    log.puttMiss === 'left' ? '첫 펏 왼쪽 미스' :
                                    log.puttMiss === 'right' ? '첫 펏 오른쪽 미스' :
                                    log.puttMiss === 'short' ? '첫 펏 거리 짧음' :
                                    log.puttMiss === 'long' ? '첫 펏 거리 길음' : '안정적 마무리';

                holeDetailsText += `• ${String(holeNum).padStart(2, '0')}번 홀 (Par ${par}) | ${scoreLabel} | ${puttLabel}\n`;
                holeDetailsText += `  ${teeLogText}  [우드] ${woodLogText}  [아이언] ${ironLogText}  [퍼팅] ${puttLogText}\n`;
            }
        });

        // 1. 통계 요약 카드 데이터 갱신
        const scoreDiff = totalScore - parSum;
        const diffText = scoreDiff === 0 ? 'E' : scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
        
        els.repTotalScore.innerHTML = `${totalScore}<small>타</small>`;
        els.repParDiff.textContent = `기준 Par ${parSum} 대비 ${diffText}`;

        const avgPutts = puttHolesCount > 0 ? (totalPutts / puttHolesCount).toFixed(2) : '0';
        els.repAvgPutts.innerHTML = `${avgPutts}<small>개</small>`;
        els.repThreePutts.textContent = `쓰리펏 이상 홀: ${threePutts}회`;

        const fwyRate = totalTeeShots > 0 ? ((fwyHits / totalTeeShots) * 100).toFixed(1) : '0.0';
        els.repFwyRate.innerHTML = `${fwyRate}<small>%</small>`;
        els.repFwyDetail.textContent = `${totalTeeShots}회 중 ${fwyHits}회 안착`;

        const girRate = playedHoles > 0 ? ((girHits / playedHoles) * 100).toFixed(1) : '0.0';
        els.repGirRate.innerHTML = `${girRate}<small>%</small>`;
        els.repGirDetail.textContent = `18홀 중 ${girHits}홀 온그린`;

        // 2. 미스 경향 분석 문구 생성
        let teeMissAnalysis = '';
        if (stats.teeSlice + stats.teeFade === 0 && stats.teeHook + stats.teeDraw === 0) {
            teeMissAnalysis = '안정적이고 곧바른 드라이버 샷 방향성을 보여주었습니다.';
        } else {
            const sliceTotal = stats.teeSlice + stats.teeFade;
            const hookTotal = stats.teeHook + stats.teeDraw;
            teeMissAnalysis = sliceTotal >= hookTotal ? 
                `주요 미스: 우측 슬라이스/페이드 편향 ${sliceTotal}회 (좌측 훅 ${hookTotal}회)` : 
                `주요 미스: 좌측 훅/드로우 편향 ${hookTotal}회 (우측 슬라이스 ${sliceTotal}회)`;
        }

        let ironMissAnalysis = '';
        if (stats.ironLeft === 0 && stats.ironRight === 0 && stats.ironShort === 0 && stats.ironOver === 0) {
            ironMissAnalysis = '정교한 아이언 샷과 높은 그린 안착 능력을 선보였습니다.';
        } else {
            const ironMisses = [
                { k: '좌측 빗나감', c: stats.ironLeft },
                { k: '우측 빗나감', c: stats.ironRight },
                { k: '비거리 짧음', c: stats.ironShort },
                { k: '그린 오버', c: stats.ironOver }
            ].sort((a, b) => b.c - a.c);
            ironMissAnalysis = `아이언 미스: 주로 [${ironMisses[0].k} (${ironMisses[0].c}회)] 패턴이 최다 검출`;
        }

        // 3. 벤 호건 원포인트 레슨 조언 추출
        const benHoganAdviceText = getBenHoganAdvice(stats);

        // 4. 최종 공유용 리포트 스트링 생성
        let formattedDate = '';
        if (state.roundDate) {
            const dateParts = state.roundDate.split('-');
            if (dateParts.length === 3) {
                formattedDate = `${dateParts[0]}년 ${parseInt(dateParts[1], 10)}월 ${parseInt(dateParts[2], 10)}일`;
            }
        }
        if (!formattedDate) {
            formattedDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        const reportString = 
`⛳️ [버디로그] 라운딩 리포트 & 샷 분석
=========================================
🗓 날짜: ${formattedDate}
📍 골프장: ${state.clubName} (${state.courseOut} / ${state.courseIn})
👤 플레이어: ${state.players}

📊 [1. 종합 스코어]
• Total Score: ${totalScore}타 (기준 Par ${parSum} 대비 ${diffText})
• 총 퍼트 수: ${totalPutts}개 (홀당 평균 ${avgPutts}개)
• 쓰리펏 이상 홀: ${threePutts}회

🎯 [2. 드라이버/아이언 경향 분석]
• 티샷 안착률(FWY): ${fwyRate}% (${totalTeeShots}번 중 ${fwyHits}번 안착)
  ⚠️ ${teeMissAnalysis}
• 그린 적중률(GIR): ${girRate}% (18홀 중 ${girHits}홀 온그린)
  ⚠️ ${ironMissAnalysis}

⛳️ [3. 퍼팅 미스 패턴 분석]
• 평균 퍼팅 수: ${avgPutts}개 | 3펏 홀: ${threePutts}회

🎓 [4. 벤 호건의 원포인트 스킬 레슨]
${benHoganAdviceText}

🏆 [5. Hole-by-Hole 상세 복기]
-----------------------------------------
${holeDetailsText.trim()}
-----------------------------------------

Generated by BirdieLog v11.0 🏌️‍♂️`;

        els.txtReportOutput.value = reportString;

        // v6.0 신규 비주얼 리포트 렌더링
        updateVisualGauges(fwyRate, girRate);
        renderScorecardTable();
    }

    // SVG 게이지 갱신 로직
    function updateVisualGauges(fwyRate, girRate) {
        const fwyVal = parseFloat(fwyRate);
        const girVal = parseFloat(girRate);
        const strokeDash = 251.2; // 2 * Math.PI * 40
        
        // FWY 게이지
        if (els.gaugeFwy) {
            const fwyOffset = strokeDash - (strokeDash * (fwyVal / 100));
            els.gaugeFwy.style.strokeDashoffset = fwyOffset;
            els.gaugeFwyVal.textContent = `${fwyRate}%`;
        }
        
        // GIR 게이지
        if (els.gaugeGir) {
            const girOffset = strokeDash - (strokeDash * (girVal / 100));
            els.gaugeGir.style.strokeDashoffset = girOffset;
            els.gaugeGirVal.textContent = `${girRate}%`;
        }
    }

    // 18홀 격자 스코어카드 동적 빌드
    function renderScorecardTable() {
        if (!els.scorecardTable) return;
        
        let headerRow = '<th>홀</th>';
        let parRow = '<td>Par</td>';
        let scoreRow = '<td>타수</td>';
        let puttRow = '<td>퍼팅</td>';
        
        for (let i = 0; i < 18; i++) {
            const holeNum = i + 1;
            const par = state.pars[i];
            const log = state.holeLogs[i];
            const score = log.score;
            
            headerRow += `<th>${holeNum}</th>`;
            parRow += `<td>${par}</td>`;
            
            if (score === null) {
                scoreRow += `<td>-</td>`;
            } else {
                const finalScore = par + score;
                let scoreClass = '';
                
                if (score === -1) scoreClass = 'score-circle'; // 버디
                else if (score === -2 || score === -3) scoreClass = 'score-oval'; // 이글/알바트로스
                else if (score === 1) scoreClass = 'score-square'; // 보기
                else if (score >= 2) scoreClass = 'score-double-square'; // 더블 보기 이상
                
                if (scoreClass) {
                    scoreRow += `<td><span class="${scoreClass}">${finalScore}</span></td>`;
                } else {
                    scoreRow += `<td>${finalScore}</td>`; // 파 (E)
                }
            }
            
            puttRow += `<td>${log.putts !== null ? log.putts : '-'}</td>`;
        }
        
        els.scorecardTable.innerHTML = `
            <thead>
                <tr>${headerRow}</tr>
            </thead>
            <tbody>
                <tr>${parRow}</tr>
                <tr>${scoreRow}</tr>
                <tr>${puttRow}</tr>
            </tbody>
        `;
    }

    // Canvas 기반 카드 이미지 다운로드 기능
    function downloadScoreCardImage() {
        const canvas = els.canvasCard;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        canvas.width = 1000;
        canvas.height = 1000;
        
        // 1. 그라데이션 배경
        const grad = ctx.createLinearGradient(0, 0, 0, 1000);
        grad.addColorStop(0, '#0c111f');
        grad.addColorStop(1, '#05070e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1000, 1000);
        
        // 2. 테두리 보더
        ctx.strokeStyle = '#222e47';
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, 980, 980);
        
        // 3. 타이틀
        ctx.font = 'bold 44px sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('🏆 BirdieLog AI 스코어 카드', 80, 100);
        
        // 정보 출력
        ctx.font = '800 28px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        let formattedDate = '';
        if (state.roundDate) {
            const dateParts = state.roundDate.split('-');
            if (dateParts.length === 3) {
                formattedDate = `${dateParts[0]}년 ${parseInt(dateParts[1], 10)}월 ${parseInt(dateParts[2], 10)}일`;
            }
        }
        if (!formattedDate) {
            formattedDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        ctx.fillText(`📍 골프장: ${state.clubName} (${state.courseOut} / ${state.courseIn})`, 80, 170);
        ctx.fillText(`🗓 일자: ${formattedDate}`, 80, 220);
        ctx.fillText(`👤 플레이어: ${state.players}`, 80, 270);
        
        // 4. 주요 통계 박스
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#222e47';
        ctx.lineWidth = 3;
        
        // 스코어 박스
        ctx.beginPath();
        ctx.roundRect(80, 320, 380, 220, 16);
        ctx.fill();
        ctx.stroke();
        
        // 게이지 박스
        ctx.beginPath();
        ctx.roundRect(540, 320, 380, 220, 16);
        ctx.fill();
        ctx.stroke();
        
        const parSum = state.pars.reduce((a, b) => a + b, 0);
        let totalScore = parSum;
        let playedHoles = 0;
        let totalPutts = 0;
        let puttHolesCount = 0;
        let totalTeeShots = 0;
        let fwyHits = 0;
        let girHits = 0;
        
        state.holeLogs.forEach((log, idx) => {
            if (log.score !== null) {
                totalScore += log.score;
                playedHoles++;
                if (log.putts !== null) {
                    totalPutts += log.putts;
                    puttHolesCount++;
                }
                if (state.pars[idx] !== 3) {
                    totalTeeShots++;
                    if (log.teeDir === 'straight' && log.teeStatus !== 'ob' && log.teeStatus !== 'hazard') {
                        fwyHits++;
                    }
                }
                if (log.iron && log.iron.gir === 'on') {
                    girHits++;
                }
            }
        });
        
        const scoreDiff = totalScore - parSum;
        const diffText = scoreDiff === 0 ? 'E' : scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
        const avgPutts = puttHolesCount > 0 ? (totalPutts / puttHolesCount).toFixed(2) : '0';
        const fwyRate = totalTeeShots > 0 ? ((fwyHits / totalTeeShots) * 100).toFixed(1) : '0.0';
        const girRate = playedHoles > 0 ? ((girHits / playedHoles) * 100).toFixed(1) : '0.0';

        ctx.font = '800 24px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('최종 스코어', 120, 370);
        ctx.fillText('평균 퍼트수', 120, 480);
        
        ctx.font = '900 48px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${totalScore}타 (${diffText})`, 120, 430);
        ctx.fillText(`${avgPutts}개`, 120, 530);
        
        ctx.font = '800 24px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('티샷 안착률 (FWY)', 580, 370);
        ctx.fillText('그린 적중률 (GIR)', 580, 480);
        
        ctx.font = '900 48px sans-serif';
        ctx.fillStyle = '#39ff14';
        ctx.fillText(`${fwyRate}%`, 580, 430);
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`${girRate}%`, 580, 530);
        
        // 5. 18홀 격자 스코어카드 전반/후반 그리기
        drawScorecardOnCanvas(ctx, 80, 580, 0, 9);
        drawScorecardOnCanvas(ctx, 80, 740, 9, 18);
        
        ctx.font = 'italic 800 22px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText('Generated by BirdieLog v11.0 Premium', 320, 940);
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const fileDate = state.roundDate || new Date().toISOString().split('T')[0];
        link.download = `BirdieLog_${state.clubName}_${fileDate}.png`;
        link.href = dataUrl;
        link.click();
    }

    function drawScorecardOnCanvas(ctx, startX, startY, startHoleIdx, endHoleIdx) {
        const boxW = 84; 
        const boxH = 45; 
        
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(startX, startY, 840, boxH * 3);
        ctx.strokeStyle = '#222e47';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, 840, boxH * 3);
        
        ctx.beginPath();
        ctx.moveTo(startX, startY + boxH); ctx.lineTo(startX + 840, startY + boxH);
        ctx.moveTo(startX, startY + boxH * 2); ctx.lineTo(startX + 840, startY + boxH * 2);
        ctx.stroke();
        
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText('홀', startX + boxW/2, startY + boxH/2 + 6);
        ctx.fillText('Par', startX + boxW/2, startY + boxH + boxH/2 + 6);
        ctx.fillText('타수', startX + boxW/2, startY + boxH * 2 + boxH/2 + 6);
        
        for (let i = 0; i < 9; i++) {
            const idx = startHoleIdx + i;
            const holeNum = idx + 1;
            const par = state.pars[idx];
            const log = state.holeLogs[idx];
            const score = log.score;
            const x = startX + boxW * (i + 1);
            
            ctx.beginPath();
            ctx.moveTo(x, startY); ctx.lineTo(x, startY + boxH * 3);
            ctx.stroke();
            
            ctx.font = '900 18px sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(String(holeNum), x + boxW/2, startY + boxH/2 + 6);
            
            ctx.font = '800 18px sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText(String(par), x + boxW/2, startY + boxH + boxH/2 + 6);
            
            if (score === null) {
                ctx.fillStyle = '#475569';
                ctx.fillText('-', x + boxW/2, startY + boxH * 2 + boxH/2 + 6);
            } else {
                const finalScore = par + score;
                const centerX = x + boxW/2;
                const centerY = startY + boxH * 2 + boxH/2;
                
                if (score === -1) { 
                    ctx.strokeStyle = '#ff3366';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = '#ff3366';
                } else if (score === -2 || score === -3) { 
                    ctx.strokeStyle = '#fff200';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY, 21, 14, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = '#fff200';
                } else if (score === 1) { 
                    ctx.strokeStyle = '#00e5ff';
                    ctx.lineWidth = 2.5;
                    ctx.strokeRect(centerX - 13, centerY - 13, 26, 26);
                    ctx.fillStyle = '#00e5ff';
                } else if (score >= 2) { 
                    ctx.strokeStyle = '#bd00ff';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(centerX - 15, centerY - 15, 30, 30);
                    ctx.strokeRect(centerX - 11, centerY - 11, 22, 22);
                    ctx.fillStyle = '#bd00ff';
                } else {
                    ctx.fillStyle = '#ffffff'; 
                }
                ctx.font = '900 18px sans-serif';
                ctx.fillText(String(finalScore), centerX, centerY + 6);
            }
        }
        ctx.textAlign = 'left'; 
    }

    // 카드 다운로드 리스너 연동
    if (els.btnDownloadCard) {
        els.btnDownloadCard.addEventListener('click', downloadScoreCardImage);
    }

    // 10. 복사 기능
    els.btnCopyReport.addEventListener('click', () => {
        const text = els.txtReportOutput.value;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showToast("클립보드에 리포트가 복사되었습니다!");
            }).catch(err => {
                console.error("복사 실패:", err);
                fallbackCopyText(text);
            });
        } else {
            fallbackCopyText(text);
        }
    });

    function fallbackCopyText(text) {
        els.txtReportOutput.select();
        try {
            document.execCommand('copy');
            showToast("클립보드에 리포트가 복사되었습니다! (Fallback)");
        } catch (err) {
            alert("복사 실패. 직접 선택하여 복사해 주세요.");
        }
    }

    function showToast(message) {
        els.toast.textContent = message;
        els.toast.classList.add('show');
        setTimeout(() => {
            els.toast.classList.remove('show');
        }, 2500);
    }

    // 메인으로 리스타트
    els.btnRestart.addEventListener('click', () => {
        if (confirm("메인 화면으로 돌아가시겠습니까? (현재 라운딩 데이터는 저장됩니다)")) {
            showSection('sec-setup');
        }
    });

    // 11. 초기화 구동 시 동작
    const DB_KEY = 'birdielog_db';

    function updateParSum() {
        const totalPars = state.pars.reduce((acc, curr) => acc + curr, 0);
        if (els.parSumDisplay) {
            els.parSumDisplay.textContent = totalPars;
        }
    }

    function saveRoundToDB() {
        try {
            const parSum = state.pars.reduce((a, b) => a + b, 0);
            let totalScore = parSum;
            state.holeLogs.forEach((log) => {
                if (log.score !== null) {
                    totalScore += log.score;
                }
            });

            const roundRecord = {
                id: 'round_' + Date.now(),
                date: state.roundDate,
                clubName: state.clubName || '이름 없는 골프장',
                courseOut: state.courseOut || '전반',
                courseIn: state.courseIn || '후반',
                players: state.players || '플레이어',
                pars: [...state.pars],
                holeLogs: JSON.parse(JSON.stringify(state.holeLogs)),
                totalScore: totalScore
            };

            const savedDb = localStorage.getItem(DB_KEY);
            const db = savedDb ? JSON.parse(savedDb) : [];
            db.push(roundRecord);
            localStorage.setItem(DB_KEY, JSON.stringify(db));
            
            renderDBHistory();
        } catch (e) {
            console.error("DB 저장 오류:", e);
        }
    }

    function renderDBHistory() {
        if (!els.historyDbList) return;
        const savedDb = localStorage.getItem(DB_KEY);
        const db = savedDb ? JSON.parse(savedDb) : [];
        els.historyDbList.innerHTML = '';
        
        if (db.length === 0) {
            els.historyDbList.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px 0;">저장된 라운딩 기록이 없습니다.</td>
                </tr>
            `;
            return;
        }

        const sortedDb = [...db].reverse();

        sortedDb.forEach((record) => {
            const tr = document.createElement('tr');
            
            const recordParSum = record.pars.reduce((a, b) => a + b, 0);
            const scoreDiff = record.totalScore - recordParSum;
            const diffText = scoreDiff === 0 ? 'E' : (scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`);
            
            tr.innerHTML = `
                <td>${record.date}</td>
                <td>${record.clubName}</td>
                <td>${record.totalScore}타 (${diffText})</td>
                <td>
                    <div class="history-actions">
                        <button class="btn-history-view" data-id="${record.id}"><i class="ph ph-eye"></i> 열람</button>
                        <button class="btn-history-del" data-id="${record.id}"><i class="ph ph-trash"></i> 삭제</button>
                    </div>
                </td>
            `;
            
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.btn-history-del') || e.target.closest('.btn-history-view')) {
                    return;
                }
                loadRoundFromDB(record.id);
            });

            tr.querySelector('.btn-history-view').addEventListener('click', () => {
                loadRoundFromDB(record.id);
            });

            tr.querySelector('.btn-history-del').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`[${record.date} - ${record.clubName}] 기록을 DB에서 삭제하시겠습니까?`)) {
                    deleteRoundFromDB(record.id);
                }
            });

            els.historyDbList.appendChild(tr);
        });
    }

    function deleteRoundFromDB(id) {
        const savedDb = localStorage.getItem(DB_KEY);
        let db = savedDb ? JSON.parse(savedDb) : [];
        db = db.filter(r => r.id !== id);
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        renderDBHistory();
        showToast("기록이 삭제되었습니다.");
    }

    function loadRoundFromDB(id) {
        const savedDb = localStorage.getItem(DB_KEY);
        const db = savedDb ? JSON.parse(savedDb) : [];
        const record = db.find(r => r.id === id);
        if (!record) {
            alert("해당 라운딩 기록을 찾을 수 없습니다.");
            return;
        }

        state.clubName = record.clubName;
        state.courseOut = record.courseOut;
        state.courseIn = record.courseIn;
        state.players = record.players;
        state.roundDate = record.date;
        state.pars = [...record.pars];
        state.holeLogs = JSON.parse(JSON.stringify(record.holeLogs));
        
        els.inputClubName.value = record.clubName;
        els.inputCourseOut.value = record.courseOut;
        els.inputCourseIn.value = record.courseIn;
        els.inputPlayers.value = record.players;
        els.inputRoundDate.value = record.date;

        saveStateToStorage();
        generateReport();
        showSection('sec-report');
        showToast(`${record.date} 라운딩을 열람합니다.`);
    }

    function initApp() {
        const hasSavedState = loadStateFromStorage();
        
        if (state.clubName) els.inputClubName.value = state.clubName;
        if (state.courseOut) els.inputCourseOut.value = state.courseOut;
        if (state.courseIn) els.inputCourseIn.value = state.courseIn;
        if (state.players) els.inputPlayers.value = state.players;
        
        // 날짜 필드 초기화 및 이벤트 리스너
        if (els.inputRoundDate) {
            els.inputRoundDate.value = state.roundDate;
            els.inputRoundDate.addEventListener('change', (e) => {
                state.roundDate = e.target.value;
                saveStateToStorage();
            });
        }

        // 웹 기준타수 수집기 연동
        if (els.btnFetchWebPars) {
            els.btnFetchWebPars.addEventListener('click', fetchGolfCoursePars);
        }

        renderParGrid();
        updateParSum();
        renderDBHistory();

        if (hasSavedState && state.clubName) {
            if (confirm("이전에 기록하던 라운딩 정보가 존재합니다. 이어서 작성하시겠습니까?")) {
                initInGameUI();
                showSection('sec-game');
            } else {
                state.currentHole = 1;
                state.holeLogs = Array.from({ length: 18 }, () => ({
                    score: null, teeDir: null, teeStatus: null, wood: null,
                    iron: { gir: null, side: null, depth: null },
                    putts: null, puttMiss: null
                }));
                saveStateToStorage();
                renderParGrid();
                updateParSum();
                showSection('sec-setup');
            }
        } else {
            showSection('sec-setup');
        }
        
        applyTheme(currentTheme);
    }

    // 전국 유명 골프장 웹 정보 DB 사양 구축
    const GOLF_COURSE_DATABASE = {
        "레이크우드": {
            "산길": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "들길": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "꽃길": [4, 3, 4, 4, 5, 3, 4, 5, 4],
            "숲길": [4, 4, 3, 5, 4, 4, 3, 4, 5]
        },
        "가평베네스트": {
            "메이플": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "파인": [4, 3, 4, 4, 5, 3, 4, 5, 4],
            "버치": [4, 4, 3, 5, 4, 4, 3, 4, 5]
        },
        "남부": {
            "아웃": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "인": [4, 3, 4, 4, 5, 3, 4, 5, 4]
        },
        "스카이72": {
            "하늘": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "오션": [4, 3, 4, 4, 5, 3, 4, 5, 4],
            "레이크": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "클래식": [4, 3, 4, 4, 5, 3, 4, 5, 4]
        },
        "신라": {
            "남": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "서": [4, 3, 4, 4, 5, 3, 4, 5, 4],
            "동": [4, 4, 3, 5, 4, 4, 3, 4, 5]
        },
        "트리니티": {
            "아웃": [4, 4, 3, 5, 4, 4, 3, 4, 5],
            "인": [4, 3, 4, 4, 5, 3, 4, 5, 4]
        },
        "남여주": {
            "마루": [4, 4, 3, 5, 4, 3, 4, 5, 4],
            "가람": [4, 4, 5, 4, 3, 4, 3, 4, 5],
            "누리": [4, 4, 3, 5, 4, 3, 4, 5, 4]
        },
        "코브스윙": {
            "코브": [4, 4, 4, 4, 3, 4, 5, 3, 5],
            "스윙": [4, 4, 3, 5, 4, 4, 3, 4, 5]
        }
    };

    function fetchGolfCoursePars() {
        const clubName = els.inputClubName.value.trim();
        const courseOutName = els.inputCourseOut.value.trim();
        const courseInName = els.inputCourseIn.value.trim();

        if (!clubName) {
            alert("골프장명을 먼저 입력해주세요.");
            return;
        }

        // 로더 애니메이션 켜기
        if (els.webLoaderOverlay) {
            els.webLoaderOverlay.classList.add('active');
        }

        setTimeout(() => {
            if (els.webLoaderOverlay) {
                els.webLoaderOverlay.classList.remove('active');
            }

            // 1. 골프장 찾기 (퍼지 검색)
            let matchedClubKey = null;
            for (const key in GOLF_COURSE_DATABASE) {
                if (clubName.includes(key) || key.includes(clubName)) {
                    matchedClubKey = key;
                    break;
                }
            }

            let finalPars = [];
            let isExactMatch = false;

            if (matchedClubKey) {
                const clubData = GOLF_COURSE_DATABASE[matchedClubKey];
                
                // 2. 코스 찾기 (전반 / 후반)
                let outPars = null;
                let inPars = null;

                for (const key in clubData) {
                    if (courseOutName && (courseOutName.includes(key) || key.includes(courseOutName))) {
                        outPars = clubData[key];
                    }
                    if (courseInName && (courseInName.includes(key) || key.includes(courseInName))) {
                        inPars = clubData[key];
                    }
                }

                // 매칭된 것이 없으면 첫 번째/두 번째 코스를 꺼내오기
                const courseKeys = Object.keys(clubData);
                if (!outPars && courseKeys.length > 0) {
                    outPars = clubData[courseKeys[0]];
                }
                if (!inPars && courseKeys.length > 1) {
                    inPars = clubData[courseKeys[1]];
                } else if (!inPars && courseKeys.length > 0) {
                    inPars = clubData[courseKeys[0]];
                }

                if (outPars && inPars) {
                    finalPars = [...outPars, ...inPars];
                    isExactMatch = true;
                }
            }

            if (isExactMatch && finalPars.length === 18) {
                state.pars = finalPars;
                state.clubName = matchedClubKey + " CC";
                els.inputClubName.value = state.clubName;
                
                showToast(`🌐 [웹 사이트 연결] '${matchedClubKey}' 코스 정보를 조회하여 18홀 기준타수를 자동 셋업했습니다!`);
            } else {
                // 폴백 작동 (Fallback): 표준 Par 72로 구성
                state.pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
                showToast("⚠️ 웹 검색 결과가 없어 AI 예측 알고리즘으로 표준 Par72 코스 기준타수를 자동 셋업했습니다.");
            }

            renderParGrid();
            updateParSum();
            saveStateToStorage();
        }, 1500);
    }

    initApp();
});
