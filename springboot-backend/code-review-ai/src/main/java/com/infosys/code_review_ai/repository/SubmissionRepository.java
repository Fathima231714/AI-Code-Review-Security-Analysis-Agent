package com.infosys.code_review_ai.repository;
import com.infosys.code_review_ai.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SubmissionRepository extends JpaRepository<Submission, String> {}
