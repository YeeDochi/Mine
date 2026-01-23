package org.example.mine.service;

import org.example.mine.dto.BaseGameRoom;
import org.example.mine.dto.MineRoom;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomService {
    private final Map<String, BaseGameRoom> rooms = new ConcurrentHashMap<>();

    public MineRoom createRoom(String name, int rows, int cols, int mines) {
        MineRoom room = new MineRoom(name, rows, cols, mines);
        rooms.put(room.getRoomId(), room);
        return room;
    }

    public BaseGameRoom findRoom(String roomId) {
        return rooms.get(roomId);
    }

    public List<BaseGameRoom> findAll() {
        return new ArrayList<>(rooms.values());
    }

    public void deleteRoom(String roomId) {
        rooms.remove(roomId);
    }
}