package com.mindflow.repository;

import com.mindflow.entity.MindflowDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MindflowDocumentRepository extends JpaRepository<MindflowDocument, String> {

    List<MindflowDocument> findAllByOrderByUploadedAtDesc();
}