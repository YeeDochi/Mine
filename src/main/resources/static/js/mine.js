// [mine.js] - Core 라이브러리 규칙 준수

const MineGame = {
    myId: null,
    isPlaying: false,

    // [필수 구현] 방에 입장했을 때 호출됨
    onEnterRoom: () => {
        console.log("MineGame: Joined Room");
        MineGame.myId = null;
        MineGame.isPlaying = false;
        document.getElementById('board').innerHTML = ''; // 보드 초기화
    },

    // [필수 구현] 서버 메시지 처리
    handleMessage: (msg, myId) => {
        MineGame.myId = myId;

        const type = msg.type;
        const data = msg.data;

        // 공통: 플레이어 목록 갱신 등은 Core가 처리하지 않으므로 필요시 여기서 UI 업데이트
        if (data && data.playerNames) {
            updatePlayerCount(data.playerNames);
        }

        if (type === 'GAME_START') {
            MineGame.isPlaying = true;
            updateStatus("게임 중", "#28a745");
            Core.showAlert("게임 시작! 지뢰를 찾으세요.");
            renderBoard(data);
        }
        else if (type === 'UPDATE') {
            renderBoard(data);
        }
        else if (type === 'GAME_OVER') {
            MineGame.isPlaying = false;
            updateStatus("게임 종료", "#dc3545");
            renderBoard(data); // 최종 상태(지뢰 공개) 렌더링

            if (data.isWin) {
                confetti({ particleCount: 150, spread: 60 });
                Core.showAlert("승리! " + msg.content);
            } else {
                Core.showAlert("패배... " + msg.content);
            }
        }
        // JOIN 시에도 현재 스냅샷이 오므로 렌더링
        else if (type === 'JOIN' && data) {
            if(data.playing) MineGame.isPlaying = true;
            renderBoard(data);
        }
    },

    // 액션 메서드들
    startGame: () => {
        // Core.sendAction을 통해 서버로 전송
        Core.sendAction({ actionType: "START" });
    },

    openCell: (r, c) => {
        if (!MineGame.isPlaying) return;
        Core.sendAction({ actionType: "OPEN", row: r, col: c });
    },

    toggleFlag: (r, c) => {
        if (!MineGame.isPlaying) return;
        Core.sendAction({ actionType: "FLAG", row: r, col: c });
    }
};

// --- Helper Functions (UI Rendering) ---

function updateStatus(text, color) {
    const badge = document.getElementById('game-status');
    badge.innerText = text;
    badge.style.background = color;
}

function updatePlayerCount(namesMap) {
    const count = Object.keys(namesMap).length;
    document.getElementById('player-count').innerText = `참여자: ${count}명`;
}

function renderBoard(data) {
    if (!data || !data.board) return;

    const boardEl = document.getElementById("board");
    boardEl.innerHTML = ""; // 초기화

    const boardData = data.board;
    const viewState = data.viewState;

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";

            const state = viewState[r][c];
            const value = boardData[r][c];

            // 0: 닫힘
            if (state === 0) {
                cell.onclick = () => MineGame.openCell(r, c);
                cell.oncontextmenu = (e) => {
                    e.preventDefault();
                    MineGame.toggleFlag(r, c);
                };
            }
            // 1: 열림
            else if (state === 1) {
                cell.classList.add("open");
                if (value === -1) {
                    cell.classList.add("mine");
                    cell.innerHTML = '<i class="fas fa-bomb"></i>';
                } else if (value > 0) {
                    cell.innerText = value;
                    cell.classList.add("num-" + value);
                }
            }
            // 2: 깃발
            else if (state === 2) {
                cell.classList.add("flag");
                cell.innerHTML = '<i class="fas fa-flag"></i>';
                cell.oncontextmenu = (e) => {
                    e.preventDefault();
                    MineGame.toggleFlag(r, c);
                };
            }

            boardEl.appendChild(cell);
        }
    }
}