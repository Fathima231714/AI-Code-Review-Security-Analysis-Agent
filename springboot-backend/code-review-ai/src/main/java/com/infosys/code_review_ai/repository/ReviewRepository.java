package com.infosys.code_review_ai.repository;
import com.infosys.code_review_ai.entity.Review;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ReviewRepository extends JpaRepository<Review, String> {
    List<Review> findTop12ByOrderByCreatedAtDesc();
}
