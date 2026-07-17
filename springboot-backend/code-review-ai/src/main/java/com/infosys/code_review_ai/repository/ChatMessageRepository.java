package com.infosys.code_review_ai.repository;
import com.infosys.code_review_ai.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ChatMessageRepository extends JpaRepository<ChatMessage, String> {}
