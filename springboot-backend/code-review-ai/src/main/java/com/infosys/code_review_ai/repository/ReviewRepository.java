package com.infosys.code_review_ai.repository;
import com.infosys.code_review_ai.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ReviewRepository extends JpaRepository<Review, String> {}
