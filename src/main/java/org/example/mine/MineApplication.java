package org.example.mine;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"org.example.mine", "org.example.common"})
public class MineApplication {

    public static void main(String[] args) {
        SpringApplication.run(MineApplication.class, args);
    }

}
