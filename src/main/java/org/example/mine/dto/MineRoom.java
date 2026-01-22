package org.example.mine.dto;

import lombok.Getter;
import lombok.Setter;
import java.util.*;

@Getter @Setter
public class MineRoom extends BaseGameRoom {
    private static final int ROWS = 10;
    private static final int COLS = 10;
    private static final int MINES = 15;

    // -1: 지뢰, 0~8: 주변 지뢰 수
    private int[][] board = new int[ROWS][COLS];

    // 0: 닫힘, 1: 열림, 2: 깃발
    private int[][] viewState = new int[ROWS][COLS];

    private int remainingCells; // 승리 조건 체크용

    public MineRoom(String name) {
        super(name);
        // 방 생성 시 게임 초기화 (대기 상태 없이 바로 시작 가능하도록 설정하거나, START 버튼으로 시작)
        // 여기서는 START 버튼을 누르기 전까진 빈 화면이거나 초기화된 상태 유지
    }

    // ★ [요구사항 반영] 입장 시 현재 게임 상태 반환
    @Override
    public Map<String, Object> getGameSnapshot() {
        Map<String, String> playerNames = new HashMap<>();
        users.values().forEach(p -> playerNames.put(p.getId(), p.getNickname()));

        return Map.of(
                "board", board,
                "viewState", viewState,
                "playing", playing,
                "playerNames", playerNames,
                "remainingCells", remainingCells
        );
    }

    public void startGame() {
        for(int i=0; i<ROWS; i++) {
            Arrays.fill(board[i], 0);
            Arrays.fill(viewState[i], 0);
        }
        this.remainingCells = (ROWS * COLS) - MINES;
        this.playing = true;

        placeMines();
        calculateNumbers();
    }

    private void placeMines() {
        Random rand = new Random();
        int count = 0;
        while(count < MINES) {
            int r = rand.nextInt(ROWS);
            int c = rand.nextInt(COLS);
            if(board[r][c] != -1) {
                board[r][c] = -1;
                count++;
            }
        }
    }

    private void calculateNumbers() {
        int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1};
        int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1};

        for(int r=0; r<ROWS; r++) {
            for(int c=0; c<COLS; c++) {
                if(board[r][c] == -1) continue;
                int cnt = 0;
                for(int i=0; i<8; i++) {
                    int nr = r + dr[i];
                    int nc = c + dc[i];
                    if(isValid(nr, nc) && board[nr][nc] == -1) cnt++;
                }
                board[r][c] = cnt;
            }
        }
    }

    private boolean isValid(int r, int c) {
        return r >= 0 && r < ROWS && c >= 0 && c < COLS;
    }

    @Override
    public synchronized GameMessage handleAction(GameMessage message) {
        String type = (String) message.getData().get("actionType");
        String senderId = message.getSenderId();

        if ("START".equals(type)) {
            if (playing) return null;
            startGame();
            return makeStateMessage("GAME_START", "지뢰찾기 시작! 지뢰를 피해 칸을 여세요.");
        }

        if (!playing) return null;

        if ("OPEN".equals(type)) {
            int r = (int) message.getData().get("row");
            int c = (int) message.getData().get("col");
            if (isValid(r, c) && viewState[r][c] == 0) {
                if (board[r][c] == -1) {
                    return finishGame(false, message.getSender());
                } else {
                    openCell(r, c);
                    if (remainingCells == 0) return finishGame(true, message.getSender());
                    return makeStateMessage("UPDATE", null);
                }
            }
        }

        if ("FLAG".equals(type)) {
            int r = (int) message.getData().get("row");
            int c = (int) message.getData().get("col");
            if (isValid(r, c)) {
                if (viewState[r][c] == 0) viewState[r][c] = 2;
                else if (viewState[r][c] == 2) viewState[r][c] = 0;
                return makeStateMessage("UPDATE", null);
            }
        }

        return null;
    }

    private void openCell(int r, int c) {
        if (!isValid(r, c) || viewState[r][c] != 0) return;

        viewState[r][c] = 1;
        remainingCells--;

        if (board[r][c] == 0) {
            int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1};
            int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1};
            for(int i=0; i<8; i++) openCell(r + dr[i], c + dc[i]);
        }
    }

    private GameMessage finishGame(boolean win, String lastUser) {
        this.playing = false;
        String content = win ? "승리! (" + lastUser + ")" : "지뢰 폭발! (" + lastUser + ")";

        // 종료 시 지뢰 모두 공개
        for(int r=0; r<ROWS; r++) {
            for(int c=0; c<COLS; c++) {
                if(board[r][c] == -1) viewState[r][c] = 1;
            }
        }

        GameMessage msg = makeStateMessage("GAME_OVER", content);
        msg.getData().put("isWin", win);
        msg.getData().put("winner", win ? lastUser : "Mines");
        return msg;
    }

    private GameMessage makeStateMessage(String type, String content) {
        GameMessage msg = new GameMessage();
        msg.setType(type);
        msg.setRoomId(this.roomId);
        msg.setContent(content);
        msg.setData(new HashMap<>(getGameSnapshot())); // getGameSnapshot 재사용
        return msg;
    }
}