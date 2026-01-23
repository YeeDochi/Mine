package org.example.mine.dto;

import lombok.Getter;
import lombok.Setter;
import java.util.*;
import java.util.stream.Collectors;

@Getter @Setter
public class MineRoom extends BaseGameRoom {
    private int ROWS = 10;
    private int COLS = 10;
    private int MINES = 15;

    private int[][] board; // -1:지뢰, 0~8:숫자
    private int[][] viewState; // 0:닫힘, 1:열림, 2:깃발

    // 게임 진행 상태 변수
    private int remainingNonMineCells; // 남은 안전 구역 수 (0이 되면 생존자 승리)

    // 턴 & 생존 관리
    private List<String> turnOrder = new ArrayList<>(); // 턴 순서
    private int currentTurnIndex = 0;
    private Set<String> eliminatedUsers = new HashSet<>(); // 탈락자 목록

    public MineRoom(String name, int r, int c, int m) {
        super(name);
        this.ROWS = r;
        this.COLS = c;
        this.MINES = m;
        this.board = new int[ROWS][COLS];
        this.viewState = new int[ROWS][COLS];
    }

    @Override
    public Map<String, Object> getGameSnapshot() {
        Map<String, String> playerNames = new HashMap<>();
        users.values().forEach(p -> playerNames.put(p.getId(), p.getNickname()));

        String currentTurnId = "";
        if (playing && !turnOrder.isEmpty()) {
            currentTurnId = turnOrder.get(currentTurnIndex);
        }

        return Map.of(
                "board", board,
                "viewState", viewState,
                "playing", playing,
                "playerNames", playerNames,
                "currentTurnId", currentTurnId,
                "eliminatedUsers", eliminatedUsers, // 탈락자 명단 전송
                "remainingCells", remainingNonMineCells
        );
    }

    public void startGame() {
        // 1. 보드 초기화
        for(int i=0; i<ROWS; i++) {
            Arrays.fill(board[i], 0);
            Arrays.fill(viewState[i], 0);
        }
        eliminatedUsers.clear();

        // 2. 턴 순서 섞기
        turnOrder = new ArrayList<>(users.keySet());
        Collections.shuffle(turnOrder);
        currentTurnIndex = 0;

        // 3. 지뢰 배치 및 계산
        placeMines();
        calculateNumbers();

        // 지뢰가 아닌 칸의 개수 계산
        this.remainingNonMineCells = (ROWS * COLS) - MINES;
        this.playing = true;
    }

    @Override
    public synchronized GameMessage handleAction(GameMessage message) {
        String type = (String) message.getData().get("actionType");
        String senderId = message.getSenderId();

        // 시작 요청
        if ("START".equals(type)) {
            if (playing) return null;
            startGame();
            return makeStateMessage("GAME_START", "게임을 시작합니다! 순서가 무작위로 결정되었습니다.");
        }

        if (!playing) return null;

        // 이미 탈락한 유저가 행동하려 할 때
        if (eliminatedUsers.contains(senderId)) {
            return null;
        }

        // 턴 체크 (싱글일 땐 체크 불필요하지만, 로직 통일성을 위해 유지)
        String currentUserId = turnOrder.get(currentTurnIndex);
        if (!senderId.equals(currentUserId)) {
            return null; // 내 턴 아님
        }

        if ("OPEN".equals(type)) {
            int r = (int) message.getData().get("row");
            int c = (int) message.getData().get("col");

            if (!isValid(r, c) || viewState[r][c] != 0) return null;

            // 1. 지뢰를 밟음! (탈락 로직)
            if (board[r][c] == -1) {
                viewState[r][c] = 1; // 지뢰 공개
                eliminatedUsers.add(senderId); // 탈락자 명단 추가

                // 생존자 수 체크
                long survivorCount = turnOrder.size() - eliminatedUsers.size();

                // Case A: 모두 죽음 (패배) - 싱글 플레이 포함
                if (survivorCount == 0) {
                    return finishGame("GAME_OVER", false, "모두 전멸했습니다...", null);
                }

                // Case B: 최후의 1인 생존 (승리) - 멀티 플레이만 해당
                if (users.size() > 1 && survivorCount == 1) {
                    // 남은 1명 찾기
                    String winnerId = turnOrder.stream()
                            .filter(id -> !eliminatedUsers.contains(id))
                            .findFirst().orElse("");
                    return finishGame("GAME_OVER", true, "최후의 생존자 승리!", List.of(winnerId));
                }

                // Case C: 아직 여러 명 생존 (게임 계속)
                passTurnToNextSurvivor();
                return makeStateMessage("UPDATE", message.getSender() + "님 탈락! 💥");
            }
            // 2. 빈칸 (계속 진행)
            else {
                openCell(r, c);

                // 모든 안전 구역을 다 찾음 (공동 승리)
                if (remainingNonMineCells == 0) {
                    // 살아있는 모든 사람 승리
                    List<String> survivors = turnOrder.stream()
                            .filter(id -> !eliminatedUsers.contains(id))
                            .collect(Collectors.toList());
                    return finishGame("GAME_OVER", true, "지뢰를 모두 피했습니다! 생존자 전원 승리!", survivors);
                }

                // 턴 넘기기
                passTurnToNextSurvivor();
                return makeStateMessage("UPDATE", null);
            }
        }

        return null; // FLAG 등은 생략 (필요 시 추가)
    }

    private void passTurnToNextSurvivor() {
        if (turnOrder.isEmpty()) return;

        // 무한루프 방지용 카운트
        int count = 0;
        do {
            currentTurnIndex = (currentTurnIndex + 1) % turnOrder.size();
            count++;
        } while (eliminatedUsers.contains(turnOrder.get(currentTurnIndex)) && count < turnOrder.size());
    }

    private GameMessage finishGame(String type, boolean isWin, String content, List<String> winnerIds) {
        this.playing = false;

        // 종료 시 모든 지뢰 보여주기
        for(int r=0; r<ROWS; r++) {
            for(int c=0; c<COLS; c++) {
                if(board[r][c] == -1) viewState[r][c] = 1;
            }
        }

        GameMessage msg = makeStateMessage(type, content);
        msg.getData().put("isWin", isWin);
        // 승자 명단이 있으면 콤마로 합쳐서 보냄 (클라이언트 표시용)
        if (winnerIds != null && !winnerIds.isEmpty()) {
            // 실제 이름으로 변환
            String winnerNames = winnerIds.stream()
                    .map(id -> users.get(id).getNickname())
                    .collect(Collectors.joining(", "));
            msg.getData().put("winnerName", winnerNames);
        }
        return msg;
    }

    // openCell에서 remainingNonMineCells 감소 로직 추가 필요
    private void openCell(int r, int c) {
        if (!isValid(r, c) || viewState[r][c] != 0) return;

        viewState[r][c] = 1;
        if (board[r][c] != -1) remainingNonMineCells--; // 안전지대 카운트 감소

        if (board[r][c] == 0) {
            int[] dr = {-1, -1, -1, 0, 0, 1, 1, 1};
            int[] dc = {-1, 0, 1, -1, 1, -1, 0, 1};
            for(int i=0; i<8; i++) openCell(r + dr[i], c + dc[i]);
        }
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


    private GameMessage makeStateMessage(String type, String content) {
        GameMessage msg = new GameMessage();
        msg.setType(type);
        msg.setRoomId(this.roomId);
        msg.setContent(content);
        msg.setData(new HashMap<>(getGameSnapshot())); // getGameSnapshot 재사용
        return msg;
    }
}