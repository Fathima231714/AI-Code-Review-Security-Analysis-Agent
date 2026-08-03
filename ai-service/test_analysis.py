"""Milestone 2 regression checks for known Java/Python quality and OWASP findings."""
import unittest
from unittest.mock import patch

from app import CodeRequest, QuestionRequest, ask_knowledge, build_pr_summary, code_analysis_agent, remediation_agent, run_review, security_agent


class AgentDetectionTests(unittest.TestCase):
    def test_java_sql_injection_and_secret_are_located(self):
        code = '''public class UserLookup {
  String apiKey = "demo-secret-key-123";
  void find(String username) {
    String sql = "SELECT * FROM users WHERE name = '" + username + "'";
  }
}'''
        findings, remediations = security_agent(code)
        titles = {item.title for item in findings}
        self.assertIn("SQL Injection", titles)
        self.assertIn("Hardcoded Secret", titles)
        self.assertTrue(all(item.line is not None for item in findings))
        self.assertTrue(any("PreparedStatement" in fix.after_code for fix in remediations))

    def test_python_complexity_and_swallowed_exception(self):
        code = '''def review(x):
    try:
        if x == 1: pass
        if x == 2: pass
        if x == 3: pass
        if x == 4: pass
        if x == 5: pass
        if x == 6: pass
        if x == 7: pass
        if x == 8: pass
        if x == 9: pass
    except:
        pass
'''
        titles = {item.title for item in code_analysis_agent(code)}
        self.assertIn("Elevated decision complexity", titles)
        self.assertIn("Exception silently ignored", titles)

    def test_remediation_agent_generates_guidance_for_each_finding(self):
        code = '''public class Demo {
  void run(String name) {
    String sql = "SELECT * FROM users WHERE name = '" + name + "'";
  }
}'''
        security, _ = security_agent(code)
        quality = code_analysis_agent(code)
        remediations = remediation_agent(security, quality)
        self.assertEqual(len(remediations), len(security) + len(quality))
        self.assertTrue(all(remediation.after_code for remediation in remediations))
        self.assertTrue(any("PreparedStatement" in remediation.after_code for remediation in remediations))

    def test_pr_summary_agent_returns_structured_review_summary(self):
        security, _ = security_agent("String sql = \"SELECT * FROM users WHERE name = '\" + username + \"'\";")
        quality = code_analysis_agent("def review(x):\n    if x == 1: pass\n    if x == 2: pass\n    if x == 3: pass\n    if x == 4: pass\n    if x == 5: pass\n    if x == 6: pass\n    if x == 7: pass\n    if x == 8: pass\n    if x == 9: pass")
        summary = build_pr_summary(security, quality)
        self.assertIn("Executive overview", summary["executive_overview"])
        self.assertIn("Prioritized fixes", summary["prioritized_fixes"])
        self.assertIn("severity_breakdown", summary)
        self.assertTrue(0 <= summary["health_score"] <= 100)

    def test_parallel_agents_merge_security_and_quality_findings(self):
        code = '''public class Demo {
  void run(String name) {
    String sql = "SELECT * FROM users WHERE name = '" + name + "'";
    try { risky(); } catch (Exception e) { }
  }
  void risky() { }
}'''
        with patch("app.knowledge_base.search", return_value=[]), patch("app.call_llm", return_value=None):
            review = run_review(CodeRequest(code=code, language="java"))
        self.assertTrue(any(item.title == "SQL Injection" for item in review.findings))
        self.assertTrue(any(item.title == "Exception silently ignored" for item in review.code_quality))
        self.assertEqual(len(review.findings) + len(review.code_quality), sum(review.severity_breakdown.values()))
        self.assertTrue(review.health_score <= 100)

    def test_chat_history_request_is_accepted(self):
        request = QuestionRequest(question="What is SQL injection?", chat_history=[{"role": "user", "text": "Hello"}])
        with patch("app.knowledge_base.search", return_value=[]), patch("app.call_llm", return_value="Use a prepared statement."):
            response = ask_knowledge(request)
        self.assertEqual(response["answer"], "Use a prepared statement.")


if __name__ == "__main__":
    unittest.main()
