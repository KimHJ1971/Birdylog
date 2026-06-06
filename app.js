/* ==========================================================================
   버디로그 (BirdieLog) - 핵심 비즈니스 로직 및 상태 관리 스크립트
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 애플리케이션 상태 (State)
    let state = {
        clubName: '',
        courseOut: '',
        courseIn: '',
        players: '',
        pars: Array(18).fill(4), // 기본값 Par 4
        currentHole: 1, // 1~18
        holeLogs: Array.from({ length: 18 }, () => ({
            score: null,       // 상대 스코어: -1(버디), 0(파), 1(보기), 2(더블), 3(트리플), 4(기타)
            teeDir: null,      // left, center, right
            teeStatus: null,   // normal, short, hazard
            gir: null,         // on, off
            secondMiss: null,  // left_short, right_short, long, short
            putts: null,       // 1, 2, 3 (3은 3이상)
            puttMiss: null     // left, right, short, long
        }))
    };

    // 2. DOM 요소 참조
    const els = {
        secSetup: document.getElementById('sec-setup'),
        secGame: document.getElementById('sec-game'),
        secReport: document.getElementById('sec-report'),

        // 설정 화면
        inputClubName: document.getElementById('input-club-name'),
        inputCourseOut: document.getElementById('input-course-out'),
        inputCourseIn: document.getElementById('input-course-in'),
        inputPlayers: document.getElementById('input-players'),
        parGridContainer: document.getElementById('par-grid-container'),
        btnSaveTemplate: document.getElementById('btn-save-template'),
        btnLoadTemplate: document.getElementById('btn-load-template'),
        btnStartGame: document.getElementById('btn-start-game'),

        // 인게임 화면
        infoCurrentHole: document.getElementById('info-current-hole'),
        infoCurrentPar: document.getElementById('info-current-par'),
        infoLiveScore: document.getElementById('info-live-score'),
        holeNavGrid: document.getElementById('hole-nav-grid'),
        
        sumScore: document.getElementById('sum-score'),
        sumTee: document.getElementById('sum-tee'),
        sumSecond: document.getElementById('sum-second'),
        sumPutt: document.getElementById('sum-putt'),

        tabTee: document.getElementById('tab-tee'),
        tabSecond: document.getElementById('tab-second'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        panelContents: document.querySelectorAll('.panel-content'),

        btnPrevHole: document.getElementById('btn-prev-hole'),
        btnNextHole: document.getElementById('btn-next-hole'),
        btnFinishGame: document.getElementById('btn-finish-game'),
        btnResetData: document.getElementById('btn-reset-data'),

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

        // 공통
        toast: document.getElementById('toast')
    };

    // 3. SPA 섹션 전환 함수
    function showSection(sectionId) {
        [els.secSetup, els.secGame, els.secReport].forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 4. 로컬 스토리지 자동 저장 및 복구
    const STORAGE_KEY = 'birdielog_state_v1';
    const TEMPLATE_KEY = 'birdielog_course_template';

    function saveStateToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function loadStateFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // 기존 상태에 덮어쓰기
                state = { ...state, ...parsed };
                return true;
            } catch (e) {
                console.error("데이터 로드 실패:", e);
            }
        }
        return false;
    }

    function clearStorage() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // 5. [Phase 1 & 3] 설정 화면 기능 구축
    // Par 설정용 18홀 그리드 렌더링
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

        // 증감 버튼 이벤트 리스너
        els.parGridContainer.querySelectorAll('.par-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const holeIdx = parseInt(e.target.dataset.hole, 10);
                const isInc = e.target.classList.contains('inc');
                let currentPar = state.pars[holeIdx];

                if (isInc && currentPar < 5) {
                    currentPar++;
                } else if (!isInc && currentPar > 3) {
                    currentPar--;
                }

                state.pars[holeIdx] = currentPar;
                document.getElementById(`par-val-${holeIdx}`).textContent = currentPar;
                saveStateToStorage();
            });
        });
    }

    // 나의 코스 템플릿 저장
    els.btnSaveTemplate.addEventListener('click', () => {
        const templateData = {
            clubName: els.inputClubName.value.trim(),
            courseOut: els.inputCourseOut.value.trim(),
            courseIn: els.inputCourseIn.value.trim(),
            pars: state.pars
        };

        if (!templateData.clubName) {
            alert("골프장명을 입력한 뒤 템플릿을 저장해주세요.");
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
            state.pars = template.pars || Array(18).fill(4);
            
            // UI 그리드 갱신
            renderParGrid();
            saveStateToStorage();
            showToast("코스 템플릿을 불러왔습니다!");
        } catch (e) {
            console.error("템플릿 로드 에러:", e);
        }
    });

    // 라운딩 시작 버튼
    els.btnStartGame.addEventListener('click', () => {
        state.clubName = els.inputClubName.value.trim() || '이름 없는 골프장';
        state.courseOut = els.inputCourseOut.value.trim() || '전반';
        state.courseIn = els.inputCourseIn.value.trim() || '후반';
        state.players = els.inputPlayers.value.trim() || '플레이어';

        saveStateToStorage();
        initInGameUI();
        showSection('sec-game');
    });

    // 6. [Phase 2 & 3] 인게임(기록) 화면 기능 구축
    function initInGameUI() {
        renderHoleNavigation();
        updateHoleRecordScreen();
    }

    // 18홀 빠른 이동 도트 네비게이션 생성
    function renderHoleNavigation() {
        els.holeNavGrid.innerHTML = '';
        for (let i = 1; i <= 18; i++) {
            const btn = document.createElement('button');
            btn.className = `hole-nav-btn ${i === state.currentHole ? 'active' : ''}`;
            btn.textContent = i;
            btn.dataset.hole = i;
            
            // 홀의 성적이 기록되어 있으면 추가 클래스 할당
            const score = state.holeLogs[i - 1].score;
            if (score !== null) {
                btn.classList.add('recorded');
                if (score === -1) btn.classList.add('score-birdie');
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

    // 현재 홀 데이터 기반 UI 렌더링 갱신
    function updateHoleRecordScreen() {
        const holeIdx = state.currentHole - 1;
        const currentPar = state.pars[holeIdx];
        const log = state.holeLogs[holeIdx];

        // 1. 헤더 및 상태표시줄 정보 갱신
        els.infoCurrentHole.textContent = state.currentHole;
        els.infoCurrentPar.textContent = `Par ${currentPar}`;
        
        // 18홀 도트 네비게이터 active 위치 갱신
        document.querySelectorAll('.hole-nav-btn').forEach(btn => {
            const h = parseInt(btn.dataset.hole, 10);
            btn.classList.remove('active');
            if (h === state.currentHole) {
                btn.classList.add('active');
            }
        });

        // 실시간 누적 스코어 연산
        updateLiveScore();

        // 2. Par 3 홀인 경우 티샷 드라이버 무력화(GIR로 유도)
        if (currentPar === 3) {
            els.tabTee.classList.add('disabled');
            els.tabTee.style.opacity = '0.3';
            els.tabTee.style.pointerEvents = 'none';
        } else {
            els.tabTee.classList.remove('disabled');
            els.tabTee.style.opacity = '1';
            els.tabTee.style.pointerEvents = 'auto';
        }

        // 3. 기록 요약 카드 갱신
        updateSummaryCard(log, currentPar);

        // 4. 입력 버튼들의 'selected' 활성화 리셋 및 갱신
        syncInputButtons(log);

        // 기본적으로 스코어 탭으로 뷰 리셋
        switchInputTab('score');
    }

    // 실시간 누적 스코어 계산 및 반영
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

    // 홀 성적 요약 카드 데이터 반영
    function updateSummaryCard(log, currentPar) {
        // 성적
        if (log.score === null) {
            els.sumScore.textContent = '-';
            els.sumScore.className = 'val';
        } else {
            const labelMap = { '-1': '버디(-1)', '0': '파(E)', '1': '보기(+1)', '2': '더블(+2)', '3': '트리플(+3)', '4': '기타' };
            els.sumScore.textContent = labelMap[log.score] || '-';
            els.sumScore.className = 'val text-highlight';
            
            if (log.score === -1) els.sumScore.style.color = 'var(--neon-cyan)';
            else if (log.score === 0) els.sumScore.style.color = 'var(--neon-green)';
            else if (log.score === 1) els.sumScore.style.color = 'var(--neon-yellow)';
            else els.sumScore.style.color = 'var(--neon-red)';
        }

        // 티샷
        if (currentPar === 3) {
            els.sumTee.textContent = 'Par3 제외';
            els.sumTee.style.color = 'var(--text-muted)';
        } else {
            if (log.teeDir === 'center') {
                els.sumTee.textContent = '안착';
                els.sumTee.style.color = 'var(--neon-green)';
            } else if (log.teeDir) {
                const dirLabel = log.teeDir === 'left' ? '훅(좌)' : '슬라이스(우)';
                const statusLabel = log.teeStatus === 'hazard' ? '(OB)' : '';
                els.sumTee.textContent = `${dirLabel}${statusLabel}`;
                els.sumTee.style.color = log.teeStatus === 'hazard' ? 'var(--neon-red)' : 'var(--neon-yellow)';
            } else {
                els.sumTee.textContent = '-';
                els.sumTee.style.color = 'var(--text-primary)';
            }
        }

        // 세컨샷
        if (log.gir === 'on') {
            els.sumSecond.textContent = 'GIR 온그린';
            els.sumSecond.style.color = 'var(--neon-green)';
        } else if (log.gir === 'off') {
            const missMap = { 'left_short': '좌측짧음', 'right_short': '우측짧음', 'long': '길었음', 'short': '짧았음' };
            els.sumSecond.textContent = missMap[log.secondMiss] || '오프그린';
            els.sumSecond.style.color = 'var(--neon-yellow)';
        } else {
            els.sumSecond.textContent = '-';
            els.sumSecond.style.color = 'var(--text-primary)';
        }

        // 퍼팅
        if (log.putts) {
            const missLabel = log.puttMiss ? `(${log.puttMiss === 'left' ? '왼쪽' : log.puttMiss === 'right' ? '오른쪽' : log.puttMiss === 'short' ? '짧음' : '길음'})` : '';
            els.sumPutt.textContent = `${log.putts}펏${log.putts >= 3 ? ' ⚠️' : ''}`;
            els.sumPutt.style.color = log.putts >= 3 ? 'var(--neon-red)' : 'var(--text-primary)';
        } else {
            els.sumPutt.textContent = '-';
            els.sumPutt.style.color = 'var(--text-primary)';
        }
    }

    // 각 패널 터치 버튼 선택값 바인딩 동기화
    function syncInputButtons(log) {
        // 스코어
        document.querySelectorAll('.score-btn').forEach(btn => {
            const val = parseInt(btn.dataset.val, 10);
            btn.classList.remove('selected');
            if (log.score === val) btn.classList.add('selected');
        });

        // 티샷
        document.querySelectorAll('.tee-dir').forEach(btn => {
            btn.classList.remove('selected');
            if (log.teeDir === btn.dataset.dir) btn.classList.add('selected');
        });
        document.querySelectorAll('.tee-status').forEach(btn => {
            btn.classList.remove('selected');
            if (log.teeStatus === btn.dataset.status) btn.classList.add('selected');
        });

        // 세컨샷
        document.querySelectorAll('.gir-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (log.gir === btn.dataset.gir) btn.classList.add('selected');
        });
        document.querySelectorAll('.second-miss').forEach(btn => {
            btn.classList.remove('selected');
            if (log.secondMiss === btn.dataset.miss) btn.classList.add('selected');
        });

        // 퍼팅
        document.querySelectorAll('.putt-count').forEach(btn => {
            btn.classList.remove('selected');
            if (log.putts === parseInt(btn.dataset.putts, 10)) btn.classList.add('selected');
        });
        document.querySelectorAll('.putt-miss').forEach(btn => {
            btn.classList.remove('selected');
            if (log.puttMiss === btn.dataset.miss) btn.classList.add('selected');
        });

        // 온그린 시 세컨샷 미스 방향 숨기기
        const secondMissSection = document.getElementById('second-miss-section');
        if (log.gir === 'on') {
            secondMissSection.style.display = 'none';
        } else {
            secondMissSection.style.display = 'block';
        }

        // 1펏 성공 시 퍼팅 미스 패턴 숨기기
        const puttMissSection = document.getElementById('putt-miss-section');
        if (log.putts === 1) {
            puttMissSection.style.display = 'none';
        } else {
            puttMissSection.style.display = 'block';
        }
    }

    // 7. 입력 패널 스위칭 및 터치 조작 핸들링
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

    // 8. 터치 버튼 동작 할당 및 오토포커스 UX
    // 스코어 터치
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = parseInt(e.currentTarget.dataset.val, 10);
            const holeIdx = state.currentHole - 1;
            state.holeLogs[holeIdx].score = val;

            // 스코어 세팅 후 오버레이 갱신
            saveStateToStorage();
            renderHoleNavigation();
            updateHoleRecordScreen();

            // Par 3 홀인 경우 다음 탭을 세컨샷으로 자동 점프
            if (state.pars[holeIdx] === 3) {
                switchInputTab('second');
            } else {
                switchInputTab('tee');
            }
        });
    });

    // 티샷 방향 터치
    document.querySelectorAll('.tee-dir').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dir = e.currentTarget.dataset.dir;
            state.holeLogs[state.currentHole - 1].teeDir = dir;
            saveStateToStorage();
            updateHoleRecordScreen();
            
            // 페어웨이 한가운데 안착하면 상태를 자동으로 '정상'으로 세팅하고 세컨샷 탭으로 이동
            if (dir === 'center') {
                state.holeLogs[state.currentHole - 1].teeStatus = 'normal';
                saveStateToStorage();
                updateHoleRecordScreen();
                setTimeout(() => switchInputTab('second'), 150);
            }
        });
    });

    // 티샷 상태 터치
    document.querySelectorAll('.tee-status').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const status = e.currentTarget.dataset.status;
            state.holeLogs[state.currentHole - 1].teeStatus = status;
            saveStateToStorage();
            updateHoleRecordScreen();
            setTimeout(() => switchInputTab('second'), 150);
        });
    });

    // 세컨샷 온그린 여부 터치
    document.querySelectorAll('.gir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gir = e.currentTarget.dataset.gir;
            state.holeLogs[state.currentHole - 1].gir = gir;
            
            if (gir === 'on') {
                state.holeLogs[state.currentHole - 1].secondMiss = null; // 미스방향 초기화
                saveStateToStorage();
                updateHoleRecordScreen();
                setTimeout(() => switchInputTab('putt'), 150);
            } else {
                saveStateToStorage();
                updateHoleRecordScreen();
            }
        });
    });

    // 세컨샷 미스 방향 터치
    document.querySelectorAll('.second-miss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const miss = e.currentTarget.dataset.miss;
            state.holeLogs[state.currentHole - 1].secondMiss = miss;
            saveStateToStorage();
            updateHoleRecordScreen();
            setTimeout(() => switchInputTab('putt'), 150);
        });
    });

    // 퍼팅 수 터치
    document.querySelectorAll('.putt-count').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const putts = parseInt(e.currentTarget.dataset.putts, 10);
            state.holeLogs[state.currentHole - 1].putts = putts;
            
            if (putts === 1) {
                state.holeLogs[state.currentHole - 1].puttMiss = null; // 미스방향 초기화
                saveStateToStorage();
                updateHoleRecordScreen();
                // 1펏 종료면 자동으로 다음 홀로 점프
                setTimeout(goToNextHole, 250);
            } else {
                saveStateToStorage();
                updateHoleRecordScreen();
            }
        });
    });

    // 퍼팅 미스 패턴 터치
    document.querySelectorAll('.putt-miss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const miss = e.currentTarget.dataset.miss;
            state.holeLogs[state.currentHole - 1].puttMiss = miss;
            saveStateToStorage();
            updateHoleRecordScreen();
            // 입력 완료 후 다음 홀로 점프
            setTimeout(goToNextHole, 250);
        });
    });

    // 홀 간 이동 기능
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

    // 데이터 복구 리셋 버튼
    els.btnResetData.addEventListener('click', () => {
        if (confirm("정말 모든 라운딩 기록을 초기화하고 처음부터 시작하시겠습니까?")) {
            clearStorage();
            state.currentHole = 1;
            state.holeLogs = Array.from({ length: 18 }, () => ({
                score: null, teeDir: null, teeStatus: null, gir: null, secondMiss: null, putts: null, puttMiss: null
            }));
            
            els.inputClubName.value = '';
            els.inputCourseOut.value = '';
            els.inputCourseIn.value = '';
            els.inputPlayers.value = '';
            
            renderParGrid();
            showSection('sec-setup');
            showToast("기록이 초기화되었습니다.");
        }
    });

    // 9. [Phase 4] 리포트 생성 및 통계 엔진
    els.btnFinishGame.addEventListener('click', () => {
        if (confirm("라운딩을 종료하고 샷 분석 리포트를 확인하시겠습니까?")) {
            generateReport();
            showSection('sec-report');
        }
    });

    // 통계 연산 및 텍스트 리포트 스트링 생성
    function generateReport() {
        const parSum = state.pars.reduce((a, b) => a + b, 0);
        let totalScore = parSum;
        let playedHoles = 0;
        
        let totalPutts = 0;
        let threePuttHoles = 0;
        let puttHolesCount = 0;

        let totalTeeShots = 0; // Par 3를 제외한 티샷 수
        let fwyHits = 0;       // 페어웨이 안착 수
        let teeMissLeft = 0;   // 훅 미스
        let teeMissRight = 0;  // 슬라이스 미스

        let girHits = 0;       // 그린 적중 수
        let girMissLeftShort = 0;
        let girMissRightShort = 0;
        let girMissLong = 0;
        let girMissShort = 0;

        let puttMissLeft = 0;
        let puttMissRight = 0;
        let puttMissShort = 0;
        let puttMissLong = 0;

        // 홀 바이 홀 데이터 기록 빌드용
        let holeDetailsText = '';

        state.holeLogs.forEach((log, idx) => {
            const holeNum = idx + 1;
            const par = state.pars[idx];
            const isPlayed = log.score !== null;

            if (isPlayed) {
                totalScore += log.score;
                playedHoles++;

                // 퍼팅 통계
                if (log.putts !== null) {
                    totalPutts += log.putts;
                    puttHolesCount++;
                    if (log.putts >= 3) {
                        threePuttHoles++;
                    }
                }

                // 티샷 통계 (Par 3 홀 제외)
                if (par !== 3) {
                    totalTeeShots++;
                    if (log.teeDir === 'center') {
                        fwyHits++;
                    } else if (log.teeDir === 'left') {
                        teeMissLeft++;
                    } else if (log.teeDir === 'right') {
                        teeMissRight++;
                    }
                }

                // 세컨샷 통계
                if (log.gir === 'on') {
                    girHits++;
                } else if (log.gir === 'off') {
                    if (log.secondMiss === 'left_short') girMissLeftShort++;
                    else if (log.secondMiss === 'right_short') girMissRightShort++;
                    else if (log.secondMiss === 'long') girMissLong++;
                    else if (log.secondMiss === 'short') girMissShort++;
                }

                // 퍼팅 미스 경향 통계
                if (log.puttMiss === 'left') puttMissLeft++;
                else if (log.puttMiss === 'right') puttMissRight++;
                else if (log.puttMiss === 'short') puttMissShort++;
                else if (log.puttMiss === 'long') puttMissLong++;

                // 텍스트 리포트 홀별 라인 작성
                const scoreLabel = log.score === -1 ? '버디 (-1)' :
                                   log.score === 0 ? '파 (E)    ' :
                                   log.score === 1 ? '보기 (+1) ' :
                                   log.score === 2 ? '더블 (+2) ' :
                                   log.score === 3 ? '트리플 (+3)' : '기타 (+4) ';

                const puttLabel = log.putts ? `${log.putts}펏${log.putts >= 3 ? ' ⚠️' : ''}` : '-';
                
                let teeLogText = '';
                if (par === 3) {
                    teeLogText = '[티샷] 아이언 티샷';
                } else {
                    const dirText = log.teeDir === 'center' ? '중앙 안착' : log.teeDir === 'left' ? '우측 슬라이스' : '좌측 훅';
                    const statusText = log.teeStatus === 'hazard' ? ' (O.B/해저드)' : log.teeStatus === 'short' ? ' (거리짧음)' : '';
                    teeLogText = `[티샷] ${dirText}${statusText}`;
                }

                const secondLogText = log.gir === 'on' ? '온그린 성공' : 
                                      log.secondMiss === 'left_short' ? '그린 좌측 짧음' :
                                      log.secondMiss === 'right_short' ? '그린 우측 짧음' :
                                      log.secondMiss === 'long' ? '그린 길었음' :
                                      log.secondMiss === 'short' ? '그린 짧았음' : '온그린 실패';

                const puttLogText = log.putts === 1 ? '1펏 컵인!' :
                                    log.puttMiss === 'left' ? '첫 펏 왼쪽 빗나감' :
                                    log.puttMiss === 'right' ? '첫 펏 오른쪽 빗나감' :
                                    log.puttMiss === 'short' ? '첫 펏 거리 짧음' :
                                    log.puttMiss === 'long' ? '첫 펏 거리 길음' : '안정적 마무리';

                holeDetailsText += `• ${String(holeNum).padStart(2, '0')}번 홀 (Par ${par}) | ${scoreLabel} | ${puttLabel}\n`;
                holeDetailsText += `  ${teeLogText}  [세컨] ${secondLogText}  [퍼팅] ${puttLogText}\n`;
            }
        });

        // 1. 주요 지표 UI 노출
        const scoreDiff = totalScore - parSum;
        const diffText = scoreDiff === 0 ? 'E' : scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
        
        els.repTotalScore.innerHTML = `${totalScore}<small>타</small>`;
        els.repParDiff.textContent = `기준 Par ${parSum} 대비 ${diffText}`;

        const avgPutts = puttHolesCount > 0 ? (totalPutts / puttHolesCount).toFixed(2) : '0';
        els.repAvgPutts.innerHTML = `${avgPutts}<small>개</small>`;
        els.repThreePutts.textContent = `쓰리펏 이상 홀: ${threePuttHoles}회`;

        const fwyRate = totalTeeShots > 0 ? ((fwyHits / totalTeeShots) * 100).toFixed(1) : '0.0';
        els.repFwyRate.innerHTML = `${fwyRate}<small>%</small>`;
        els.repFwyDetail.textContent = `${totalTeeShots}회 중 ${fwyHits}회 안착`;

        const girRate = playedHoles > 0 ? ((girHits / playedHoles) * 100).toFixed(1) : '0.0';
        els.repGIRRate = document.getElementById('rep-gir-rate');
        els.repGIRRate.innerHTML = `${girRate}<small>%</small>`;
        els.repGirDetail.textContent = `18홀 중 ${girHits}홀 온그린`;

        // 2. 미스 경향 텍스트 생성
        let teeMissAnalysis = '';
        if (teeMissLeft === 0 && teeMissRight === 0) {
            teeMissAnalysis = '안정적인 티샷 감각을 유지했습니다.';
        } else {
            const majorTeeMiss = teeMissRight >= teeMissLeft ? `우측(슬라이스) 밀림 ${teeMissRight}회` : `좌측(훅) 감김 ${teeMissLeft}회`;
            const minorTeeMiss = teeMissRight >= teeMissLeft ? `좌측(훅) ${teeMissLeft}회` : `우측(슬라이스) ${teeMissRight}회`;
            teeMissAnalysis = `주요 미스: ${majorTeeMiss}, ${minorTeeMiss}`;
        }

        let girMissAnalysis = '';
        const girMisses = [
            { key: '그린 좌측 짧음', count: girMissLeftShort },
            { key: '그린 우측 짧음', count: girMissRightShort },
            { key: '길었음(Over)', count: girMissLong },
            { key: '짧았음(Short)', count: girMissShort }
        ].sort((a, b) => b.count - a.count);

        if (girMisses[0].count === 0) {
            girMissAnalysis = '세컨 어프로치 정합성이 뛰어났습니다.';
        } else {
            girMissAnalysis = `세컨샷 미스: 주로 [${girMisses[0].key} (${girMisses[0].count}회)] 구역으로 미스가 집중됨`;
        }

        let puttMissAnalysis = '';
        const puttMisses = [
            { key: '오른쪽 빗나감', count: puttMissRight, desc: '슬라이스 라인 미스' },
            { key: '왼쪽 빗나감', count: puttMissLeft, desc: '훅 라인 미스' },
            { key: '거리 짧음', count: puttMissShort, desc: '과감하지 못한 퍼팅' },
            { key: '거리 길음', count: puttMissLong, desc: '힘 조절 실패' }
        ].sort((a, b) => b.count - a.count);

        if (puttMisses[0].count === 0) {
            puttMissAnalysis = '퍼팅 거리 및 에이밍 조절이 아주 안정적이었습니다.';
        } else {
            puttMissAnalysis = `• [${puttMisses[0].key}] ${puttMisses[0].desc} ${puttMisses[0].count}회\n`;
            if (puttMisses[1].count > 0) {
                puttMissAnalysis += `• [${puttMisses[1].key}] ${puttMisses[1].desc} ${puttMisses[1].count}회`;
            }
        }

        // 3. 최종 공유 텍스트 조립
        const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        
        const reportString = 
`⛳️ [버디로그] 라운딩 리포트 & 샷 분석
=========================================
🗓 날짜: ${todayStr}
📍 골프장: ${state.clubName} (${state.courseOut} / ${state.courseIn})
👤 플레이어: ${state.players}

📊 [1. 종합 스코어]
• Total Score: ${totalScore}타 (기준 Par ${parSum} 대비 ${diffText})
• 총 퍼트 수: ${totalPutts}개 (홀당 평균 ${avgPutts}개)
• 쓰리펏 이상 홀: ${threePuttHoles}회

🎯 [2. 드라이버/세컨샷 경향 분석]
• 티샷 안착률(FWY): ${fwyRate}% (${totalTeeShots}번 중 ${fwyHits}번 안착)
  ⚠️ ${teeMissAnalysis}
• 그린 적중률(GIR): ${girRate}% (18홀 중 ${girHits}홀 온그린)
  ⚠️ ${girMissAnalysis}

⛳️ [3. 퍼팅 미스 패턴 분석]
• 주요 빗나감 원인:
${puttMissAnalysis}

🏆 [4. Hole-by-Hole 상세 복기]
-----------------------------------------
${holeDetailsText.trim()}
-----------------------------------------

Generated by BirdieLog 🏌️‍♂️`;

        els.txtReportOutput.value = reportString;
    }

    // 10. 복사 기능 및 토스트 알림
    els.btnCopyReport.addEventListener('click', () => {
        const text = els.txtReportOutput.value;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showToast("클립보드에 리포트가 복사되었습니다!");
            }).catch(err => {
                console.error("클립보드 복사 실패:", err);
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
            alert("복사 기능이 지원되지 않는 브라우저입니다. 직접 선택하여 복사해주세요.");
        }
    }

    function showToast(message) {
        els.toast.textContent = message;
        els.toast.classList.add('show');
        setTimeout(() => {
            els.toast.classList.remove('show');
        }, 2500);
    }

    // 11. 메인으로 리스타트
    els.btnRestart.addEventListener('click', () => {
        if (confirm("메인 화면으로 돌아가시겠습니까? (현재 라운딩 데이터는 저장됩니다)")) {
            showSection('sec-setup');
        }
    });

    // 12. 어플리케이션 초기화 구동 시 로직
    function initApp() {
        const hasSavedState = loadStateFromStorage();
        
        // 설정 폼에 기존 값들 뿌리기
        if (state.clubName) els.inputClubName.value = state.clubName;
        if (state.courseOut) els.inputCourseOut.value = state.courseOut;
        if (state.courseIn) els.inputCourseIn.value = state.courseIn;
        if (state.players) els.inputPlayers.value = state.players;

        renderParGrid();

        // 만약 이미 라운딩 중인 상태가 유효하다면 인게임으로 바로 복구
        if (hasSavedState && state.clubName) {
            if (confirm("이전에 기록하던 라운딩 정보가 존재합니다. 이어서 작성하시겠습니까?")) {
                initInGameUI();
                showSection('sec-game');
            } else {
                // 이어서 작성 안 함 ➔ 초기화
                clearStorage();
                state.currentHole = 1;
                state.holeLogs = Array.from({ length: 18 }, () => ({
                    score: null, teeDir: null, teeStatus: null, gir: null, secondMiss: null, putts: null, puttMiss: null
                }));
                state.pars = Array(18).fill(4);
                renderParGrid();
                showSection('sec-setup');
            }
        } else {
            showSection('sec-setup');
        }
    }

    initApp();
});
