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

function renderBoard(data, myId) {
    const boardEl = document.getElementById("board");
    const stageEl = document.querySelector(".game-stage");

    if (!boardEl || !stageEl) return;

    const rows = data.board.length;
    const cols = data.board[0].length;

    // ============================================================
    // ★ [수정] "무조건 가로 기준" (Width-First) 로직
    // ============================================================

    // 1. 화면 크기 측정
    const isMobile = window.innerWidth <= 768;
    // 모바일은 윈도우 너비 기준, PC는 컨테이너 기준
    const screenW = isMobile ? window.innerWidth : stageEl.clientWidth;

    // 2. 가용 공간 계산
    // 모바일: 좌우 여백을 최소화 (약 10px) -> 화면 꽉 채우기 위함
    // PC: 좌우 여백 40px
    const paddingX = isMobile ? 10 : 40;

    const gap = 1; // 셀 간격 1px
    boardEl.style.gap = `${gap}px`;

    const totalGapW = (cols - 1) * gap;
    const availableW = screenW - paddingX - totalGapW;

    // 3. 셀 크기 계산 (오직 가로 공간을 칸 수로 나눔)
    const cellW = Math.floor(availableW / cols);

    let optimalSize = cellW;

    // 4. 높이 제한 (PC만 적용)
    // 모바일은 가로를 꽉 채우는 게 우선이므로 높이 때문에 쪼그라들지 않게 함
    if (!isMobile) {
        const screenH = stageEl.clientHeight;
        const paddingY = 40;
        const totalGapH = (rows - 1) * gap;
        const availableH = screenH - paddingY - totalGapH;
        const cellH = Math.floor(availableH / rows);

        // PC는 너무 커지면 안 되니까 높이 제한도 고려
        optimalSize = Math.min(cellW, cellH);
        if (optimalSize > 40) optimalSize = 40; // 최대 크기 제한
    } else {
        // [모바일] 가로 폭 기준으로만 설정 (최소 5px 안전장치만 유지)
        if (optimalSize < 5) optimalSize = 5;
    }

    // 5. 스타일 적용
    // 계산된 optimalSize를 가로/세로 모두에 적용 -> 정사각형 보장
    boardEl.style.setProperty('--cell-size', `${optimalSize}px`);
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // ============================================================

    boardEl.innerHTML = "";

    // ... (이하 기존 로직 동일: 클래스 추가, 이벤트 연결 등) ...
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