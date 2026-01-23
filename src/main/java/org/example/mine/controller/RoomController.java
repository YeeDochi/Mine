package org.example.mine.controller;

import org.example.common.service.ScoreSender;
import org.example.mine.dto.BaseGameRoom;
import org.example.mine.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {
    private final RoomService roomService;
    private final ScoreSender scoreSender;

    @RequestMapping(method = RequestMethod.HEAD)
    public void healthCheck() {
    }
    // 1. 방 목록 조회 (GET /api/rooms)
    @GetMapping
    public List<BaseGameRoom> findAllRooms() {
        return roomService.findAll();
    }

    // 2. 방 생성 (POST /api/rooms?name=...)
    @PostMapping
    public BaseGameRoom createRoom(@RequestParam String name,
                                   @RequestParam(defaultValue = "10") int rows,
                                   @RequestParam(defaultValue = "10") int cols,
                                   @RequestParam(defaultValue = "15") int mines) {
        if(rows < 5 || rows > 30) rows = 10;
        if(cols < 5 || cols > 30) cols = 10;
        if(mines >= (rows * cols)) mines = (rows * cols) / 5; // 지뢰가 너무 많으면 조정

        return roomService.createRoom(name, rows, cols, mines);
    }


    // 3. 특정 방 조회 (GET /api/rooms/{roomId})
    @GetMapping("/{roomId}")
    public BaseGameRoom getRoom(@PathVariable String roomId) {
        return roomService.findRoom(roomId);
    }

    @GetMapping("/rankings")
    public ResponseEntity<Object> getRanking(@RequestParam(required = false) String gameType) {
        return scoreSender.ranking(gameType);
    }
}