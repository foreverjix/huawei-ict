package com.mindflow.repository;

import com.mindflow.entity.DocumentTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentTaskRepository extends JpaRepository<DocumentTask, String> {

    List<DocumentTask> findByDocumentIdOrderBySeqNoAsc(String documentId);

    Optional<DocumentTask> findByDocumentIdAndId(String documentId, String id);

    void deleteByDocumentId(String documentId);
}