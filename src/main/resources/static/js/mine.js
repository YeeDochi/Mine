// [mine.js] Yacht 스타일 배지 적용

const MineGame = {
    myId: null,
    playerNames: {},
    myFlags: new Set(),

    onEnterRoom: () => {
        MineGame.myId = null;
        MineGame.playerNames = {};
        MineGame.myFlags.clear();
        console.log("Joined Mine Room.");

        const boardEl = document.getElementById('board');
        if(boardEl) boardEl.innerHTML = '';
        updateStatus(null, null);
        renderUserList({}, [], null);
    },

    handleMessage: (msg, myId) => {
        if (msg.type === 'GAME_OVER') {
            if (msg.data && msg.data.isWin) {
                confetti({ particleCount: 150, spread: 60 });
                Core.showAlert("🎉 " + msg.content);
            } else {
                Core.showAlert("☠️ " + msg.content);
            }
        }
        else if (msg.type === 'GAME_START') {
            Core.showAlert(msg.content);
        }
        else if (msg.type === 'UPDATE' && msg.content) {
            Core.showAlert(msg.content);
        }

        MineGame.myId = myId;
        const data = msg.data;
        if (!data) return;

        if (data.playerNames) {
            MineGame.playerNames = data.playerNames;
        }

        updateStatus(data, myId);
        renderUserList(MineGame.playerNames, data.eliminatedUsers || [], data.currentTurnId);
        renderBoard(data, myId);
    }
};

// --- [UI 렌더링 헬퍼] ---

function updateStatus(data, myId) {
    const statusEl = document.getElementById('game-status');
    const startBtn = document.getElementById('startBtn');

    if (!statusEl) return;

    // 1. 대기 상태 (게임 시작 전)
    if (!data || !data.playing) {
        statusEl.innerText = "대기 중";
        // 기본 스타일로 복구 (테마 변수 사용)
        statusEl.style.color = "var(--text-secondary)";
        statusEl.style.borderColor = "var(--border-color)";
        statusEl.style.background = "var(--bg-header)";

        if(startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = "게임 시작";
            startBtn.style.opacity = 1;
            startBtn.style.cursor = "pointer";
        }
        return;
    }

    // 2. 게임 진행 중 버튼 잠금
    if(startBtn) {
        startBtn.disabled = true;
        startBtn.innerText = "진행 중";
        startBtn.style.opacity = 0.6;
        startBtn.style.cursor = "not-allowed";
    }

    const isEliminated = data.eliminatedUsers && data.eliminatedUsers.includes(myId);
    const isMyTurn = (data.currentTurnId === myId);

    // ★ [수정됨] Yacht.js 스타일: 배경색 변경 없이 텍스트/테두리로만 상태 표시
    if (isEliminated) {
        statusEl.innerText = "☠️ 관전 모드";
        statusEl.style.color = "var(--status-offline)"; // 빨강
        statusEl.style.borderColor = "var(--status-offline)";
    } else if (isMyTurn) {
        statusEl.innerText = "🟢 나의 턴";
        statusEl.style.color = "var(--status-online)"; // 초록
        statusEl.style.borderColor = "var(--status-online)";
    } else {
        const turnName = MineGame.playerNames[data.currentTurnId] || '상대';
        statusEl.innerText = `🔴 ${turnName}의 턴`;
        statusEl.style.color = "var(--text-secondary)"; // 회색 톤
        statusEl.style.borderColor = "var(--status-checking)"; // 노랑/주황 계열
    }
}

function renderUserList(names, eliminatedIds, currentTurnId) {
    const listEl = document.getElementById('user-list-area');
    const countEl = document.getElementById('room-user-count');

    if (countEl) countEl.innerText = Object.keys(names).length + "명";
    if (!listEl) return;

    listEl.innerHTML = '';

    Object.keys(names).forEach(uid => {
        const row = document.createElement('div');
        row.className = 'user-row';

        // 내 턴이면 배경 강조 (CSS 클래스 활용)
        if (uid === currentTurnId) row.classList.add('active');

        const nameSpan = document.createElement('span');
        nameSpan.innerHTML = names[uid];

        if (eliminatedIds.includes(uid)) {
            nameSpan.style.textDecoration = "line-through";
            nameSpan.style.color = "#aaa";
            nameSpan.innerHTML += " 💀";
        } else if (uid === currentTurnId) {
            nameSpan.style.fontWeight = "bold";
            nameSpan.innerHTML += " 🎲"; // 턴 표시 아이콘
        }

        row.appendChild(nameSpan);
        listEl.appendChild(row);
    });
}
// [mine.js] renderBoard 함수 전체 교체

function renderBoard(data, myId) {
    const boardEl = document.getElementById("board");
    const stageEl = document.querySelector(".game-stage");

    if (!boardEl || !stageEl) return;

    const rows = data.board.length;
    const cols = data.board[0].length;

    // ============================================================
    // ★ [수정] "무조건 채워넣기" (Fit-to-Width) 로직
    // ============================================================

    // 1. 현재 화면의 전체 너비 가져오기
    // stageEl.clientWidth를 쓰면 스크롤바 영역 등이 포함될 수 있어 window.innerWidth가 모바일엔 더 안전합니다.
    const isMobile = window.innerWidth <= 768;
    const screenW = isMobile ? window.innerWidth : stageEl.clientWidth;
    const screenH = isMobile ? (window.innerHeight * 0.6) : stageEl.clientHeight; // 모바일은 높이 60% 정도만 사용

    // 2. 뺄 거 다 빼기 (패딩 + 보더 + 갭)
    // 모바일: 좌우 패딩 합쳐서 10px(여유값)
    // PC: 좌우 패딩 합쳐서 40px
    const totalPaddingX = isMobile ? 12 : 40;
    const totalPaddingY = isMobile ? 12 : 40;

    // 셀 사이의 간격 (CSS gap: 2px)
    const gap = 1; // 2px로 하면 모바일에서 너무 벌어지니 1px로 줄이거나 계산식에 반영
    boardEl.style.gap = `${gap}px`;

    // 갭이 차지하는 총 너비 = (칸수 - 1) * 갭크기
    const totalGapW = (cols - 1) * gap;
    const totalGapH = (rows - 1) * gap;

    // 3. 순수하게 셀들이 사용할 수 있는 공간 계산
    const availableW = screenW - totalPaddingX - totalGapW;
    const availableH = screenH - totalPaddingY - totalGapH;

    // 4. 나눗셈! (공간 / 칸수) -> 소수점 내림
    const cellW = Math.floor(availableW / cols);
    const cellH = Math.floor(availableH / rows);

    // 5. 가로/세로 중 더 작은 쪽에 맞춰서 정사각형 만들기
    // (단, PC에서는 너무 커지면 안되니 최대값 45px 제한은 둠)
    let optimalSize = Math.min(cellW, cellH);

    // ★ [핵심] 최소 크기 제한(10px)을 제거했습니다.
    // 대신 0px이 되면 안보이니까 최소 5px 정도의 안전장치만 둡니다.
    if (optimalSize < 5) optimalSize = 5;

    // PC에서 너무 커지는 것만 방지
    if (!isMobile && optimalSize > 40) optimalSize = 40;

    // 6. 스타일 적용
    boardEl.style.setProperty('--cell-size', `${optimalSize}px`);
    // auto-fill 대신 1fr로 강제 등분
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // ============================================================

    boardEl.innerHTML = "";

    const isEliminated = data.eliminatedUsers && data.eliminatedUsers.includes(myId);
    const isMyTurn = (data.currentTurnId === myId);
    const canInteract = data.playing && !isEliminated && isMyTurn;
    const canFlag = data.playing && !isEliminated;

    if (!canInteract && !canFlag) {
        boardEl.classList.add('disabled-board');
    } else {
        boardEl.classList.remove('disabled-board');
    }

    const boardData = data.board;
    const viewState = data.viewState;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";

            const state = viewState[r][c];
            const value = boardData[r][c];
            const cellKey = `${r},${c}`;

            if (state === 1) {
                cell.classList.add("open");
                if (MineGame.myFlags.has(cellKey)) MineGame.myFlags.delete(cellKey);

                if (value === -1) {
                    cell.classList.add("mine");
                    cell.innerHTML = '<i class="fas fa-bomb"></i>';
                } else if (value > 0) {
                    cell.innerText = value;
                    cell.classList.add("num-" + value);
                }
            } else {
                if (MineGame.myFlags.has(cellKey)) {
                    cell.innerHTML = '<i class="fas fa-flag" style="color:#e74c3c;"></i>';
                }

                if (canInteract) {
                    cell.onclick = () => {
                        if (MineGame.myFlags.has(cellKey)) return;
                        Core.sendAction({ actionType: "OPEN", row: r, col: c });
                    };
                }

                if (canFlag) {
                    cell.oncontextmenu = (e) => {
                        e.preventDefault();
                        if (MineGame.myFlags.has(cellKey)) {
                            MineGame.myFlags.delete(cellKey);
                            cell.innerHTML = '';
                        } else {
                            MineGame.myFlags.add(cellKey);
                            cell.innerHTML = '<i class="fas fa-flag" style="color:#e74c3c;"></i>';
                        }
                        return false;
                    };
                }
            }
            boardEl.appendChild(cell);
        }
    }
}
// 자동 초기화
Core.init(MineGame, {
    apiPath: '/Mine',
    wsPath: '/Mine/ws',
    gameName: '💣 Survival Mine'
});