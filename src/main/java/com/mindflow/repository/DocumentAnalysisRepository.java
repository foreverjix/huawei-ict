package com.mindflow.repository;

import com.mindflow.entity.DocumentAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentAnalysisRepository extends JpaRepository<DocumentAnalysis, String> {

    List<DocumentAnalysis> findByDocumentIdOrderByCreatedAtDesc(String documentId);

    void deleteByDocumentId(String documentId);
}