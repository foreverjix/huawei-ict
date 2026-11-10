package com.mindflow.repository;

import com.mindflow.entity.MindflowDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MindflowDocumentRepository extends JpaRepository<MindflowDocument, String> {

    List<MindflowDocument> findByOwnerIdOrderByUploadedAtDesc(String ownerId);

    Optional<MindflowDocument> findByIdAndOwnerId(String id, String ownerId);
}