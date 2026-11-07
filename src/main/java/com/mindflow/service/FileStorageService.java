package com.mindflow.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class FileStorageService {

    @Value("${mindflow.storage.root:./data/uploads}")
    private String storageRoot;

    public Path store(MultipartFile file, String storedName) {
        Path base = Paths.get(storageRoot).toAbsolutePath().normalize();
        Path target = base.resolve(storedName).normalize();
        if (!target.startsWith(base)) {
            throw new IllegalArgumentException("非法文件名");
        }
        try {
            Files.createDirectories(base);
            file.transferTo(target);
            return target;
        } catch (IOException exception) {
            throw new IllegalStateException("文件保存失败: " + exception.getMessage(), exception);
        }
    }

    public void delete(String path) {
        if (path == null || path.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Paths.get(path));
        } catch (IOException ignored) {
            // 删除失败不影响元数据清理
        }
    }
}