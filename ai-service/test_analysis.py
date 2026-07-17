"""Milestone 2 regression checks for known Java/Python quality and OWASP findings."""
import unittest
from unittest.mock import patch

from app import CodeRequest, code_analysis_agent, run_review, security_agent


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

    def test_parallel_agents_merge_security_and_quality_findings(self):
        code = '''public class Demo {
  void run(String name) {
    String sql = "SELECT * FROM users WHERE name = '" + name + "'";
    try { risky(); } catch (Exception e) { }
  }
  void risky() { }
}'''
        with patch("app.knowledge_base.search", return_value=[]), patch("app.call_ollama", return_value=None):
            review = run_review(CodeRequest(code=code, language="java"))
        self.assertTrue(any(item.title == "SQL Injection" for item in review.findings))
        self.assertTrue(any(item.title == "Exception silently ignored" for item in review.code_quality))
        self.assertEqual(len(review.findings) + len(review.code_quality), sum(review.severity_breakdown.values()))


if __name__ == "__main__":
    unittest.main()
