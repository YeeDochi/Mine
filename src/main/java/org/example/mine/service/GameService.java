package org.example.mine.service;

import org.example.mine.dto.BaseGameRoom;
import org.example.mine.dto.GameMessage;
import org.example.mine.dto.Player;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GameService {
    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;
    private final org.example.common.service.ScoreSender scoreSender;
    // 입장 처리
    public void join(String roomId, GameMessage message) {
        BaseGameRoom room = roomService.findRoom(roomId);
        if (room == null) return;
        if (room.isPlaying()) return;
        Player newPlayer = new Player(message.getSender(), message.getSenderId());

        // [추가] 로그인 유저 체크 및 ID 저장 로직
        if (message.getData() != null && message.getData().containsKey("dbUsername")) {
            String realId = (String) message.getData().get("dbUsername");
            if (realId != null && !realId.equals("null") && !realId.isEmpty()) {
                newPlayer.setDbUsername(realId);
                System.out.println("✅ 로그인 유저 입장: " + newPlayer.getNickname() + " (" + realId + ")");
            }
        }

        room.enterUser(newPlayer);

        message.setType("JOIN");
        message.setContent(message.getSender() + "님이 입장하셨습니다.");
        broadcast(roomId, message);

        // ... (기존 broadcast 코드) ...

        // [Tip] 실제 구현 시 주석 해제: 기존 유저 정보를 신규 유저에게 동기화
//        for (Player p : room.getUsers().values()) {
//            if (p.getId().equals(message.getSenderId())) continue; // 나 자신 제외
//
//            GameMessage syncMsg = GameMessage.builder()
//                    .type("JOIN")
//                    .sender(p.getNickname())
//                    .senderId(p.getId())
//                    // Player의 attributes나 skinUrl을 data에 담아서 전송
//                    .data(Map.of("semple", "semple"))
//                    .build();
//
//            messagingTemplate.convertAndSend("/topic/" + roomId, syncMsg);
//        }
        GameMessage syncMsg = new GameMessage();
        syncMsg.setType("SYNC");
        syncMsg.setRoomId(roomId);
        syncMsg.setSender("SYSTEM");
        syncMsg.setData(room.getGameSnapshot()); // BaseGameRoom에 추가한 메서드 호출

        // 특정 유저에게만 보내는 게 정석이지만, 템플릿 구조상 전체 broadcast 후 클라이언트가 필터링해도 됨
        broadcast(roomId, syncMsg);
    }

    // 게임 행동 처리 (핵심)
    public void handleGameAction(String roomId, GameMessage message) {
        BaseGameRoom room = roomService.findRoom(roomId);
        if (room != null) {
            GameMessage result = room.handleAction(message);
            if (result != null) {
                // GAME_OVER일 때 승자 정보 추출
                if ("GAME_OVER".equals(result.getType())) {
                    List<String> winnerIds = (List<String>) result.getData().get("winnerIds");
                    // endGame에 승자 명단 전달
                    endGame(roomId, new ArrayList<>(room.getUsers().values()), winnerIds);
                }
                broadcast(roomId, result);
            }
        }
    }

    public void chat(String roomId, GameMessage message) {
        // 정답 체크 로직이 필요하면 여기서 room.checkAnswer() 등을 호출 가능
        broadcast(roomId, message);
    }
    public void endGame(String roomId, List<Player> players, List<String> winnerIds) {
        // winnerIds가 null이면(전원 탈락 등) 아무도 점수를 못 받음
        if (winnerIds == null) return;

        for (Player player : players) {
            if (player.getDbUsername() == null) continue;

            if (winnerIds.contains(player.getId())) {
                scoreSender.sendScore(
                        player.getDbUsername(),
                        "Mine",
                        -1
                );
                System.out.println("🏆 승리 기록 전송: " + player.getNickname());
            }
        }
    }
    public void exit(String roomId, GameMessage message) {
        BaseGameRoom room = roomService.findRoom(roomId);
        if (room != null) {
            room.exitUser(message.getSenderId());
            if (room.getUsers().isEmpty()) {
                roomService.deleteRoom(roomId);
            } else {
                broadcast(roomId, message);
            }
        }
    }

    private void broadcast(String roomId, GameMessage message) {
        messagingTemplate.convertAndSend("/topic/" + roomId, message);
    }
}