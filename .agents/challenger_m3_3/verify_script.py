import sys
import os
import unittest
import importlib
from unittest.mock import MagicMock, patch

# Add the target directory to path
sys.path.insert(0, r"C:\Users\USER\teamwork_projects\oracle_signup")

class TestOracleSignupAutomation(unittest.TestCase):
    
    def setUp(self):
        # Ensure we reload the module for each test to reset state and sys.argv processing
        if 'oracle_signup' in sys.modules:
            importlib.reload(sys.modules['oracle_signup'])

    @patch('sys.stdin.isatty')
    @patch('oracle_signup.sync_playwright')
    def test_non_interactive_no_args(self, mock_playwright, mock_isatty):
        """
        Verify that running in a non-interactive environment without CLI parameters
        exits gracefully with status code 1.
        """
        mock_isatty.return_value = False
        
        # Mock sys.argv to have no arguments
        with patch('sys.argv', ['oracle_signup.py']):
            with self.assertRaises(SystemExit) as cm:
                import oracle_signup
                oracle_signup.main()
            self.assertEqual(cm.exception.code, 1)

    @patch('sys.stdin.isatty')
    @patch('oracle_signup.sync_playwright')
    def test_non_interactive_with_args_browser_launch_failure(self, mock_playwright, mock_isatty):
        """
        Verify that when arguments are supplied in a non-interactive environment,
        but browser launch fails (e.g. no GUI session/display), it exits with status 1
        without traceback.
        """
        mock_isatty.return_value = False
        
        # Mock playwright to raise Exception on launch
        mock_p = MagicMock()
        mock_p.chromium.launch.side_effect = Exception("No display found")
        mock_playwright.return_value.__enter__.return_value = mock_p
        
        with patch('sys.argv', ['oracle_signup.py', '--country', 'US']):
            with self.assertRaises(SystemExit) as cm:
                import oracle_signup
                oracle_signup.main()
            self.assertEqual(cm.exception.code, 1)

    @patch('sys.stdin.isatty')
    @patch('oracle_signup.sync_playwright')
    def test_navigation_dns_error(self, mock_playwright, mock_isatty):
        """
        Verify that if navigation fails due to a network/DNS error, the script exits
        gracefully with status code 1 without tracebacks.
        """
        mock_isatty.return_value = False
        
        mock_p = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        
        mock_p.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        
        # Mock page.goto to raise an exception
        mock_page.goto.side_effect = Exception("DNS Resolution Failed")
        
        mock_playwright.return_value.__enter__.return_value = mock_p
        
        with patch('sys.argv', ['oracle_signup.py', '--country', 'US']):
            with self.assertRaises(SystemExit) as cm:
                import oracle_signup
                oracle_signup.main()
            self.assertEqual(cm.exception.code, 1)

    @patch('sys.stdin.isatty')
    @patch('oracle_signup.sync_playwright')
    def test_navigation_http_error(self, mock_playwright, mock_isatty):
        """
        Verify that if navigation returns an HTTP error code (e.g. 500), the script exits
        gracefully with status code 1.
        """
        mock_isatty.return_value = False
        
        mock_p = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        mock_response = MagicMock()
        
        mock_p.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        
        # Mock response to be non-ok
        mock_response.ok = False
        mock_response.status = 500
        mock_page.goto.return_value = mock_response
        
        mock_playwright.return_value.__enter__.return_value = mock_p
        
        with patch('sys.argv', ['oracle_signup.py', '--country', 'US']):
            with self.assertRaises(SystemExit) as cm:
                import oracle_signup
                oracle_signup.main()
            self.assertEqual(cm.exception.code, 1)

    @patch('sys.stdin.isatty')
    @patch('oracle_signup.sync_playwright')
    def test_keyboard_interrupt_handling(self, mock_playwright, mock_isatty):
        """
        Verify that a KeyboardInterrupt is caught and the script exits with status 0
        without tracebacks.
        """
        mock_isatty.return_value = False
        
        mock_p = MagicMock()
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        
        mock_p.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        
        # Raise KeyboardInterrupt during page.goto
        mock_page.goto.side_effect = KeyboardInterrupt()
        
        mock_playwright.return_value.__enter__.return_value = mock_p
        
        with patch('sys.argv', ['oracle_signup.py', '--country', 'US']):
            with self.assertRaises(SystemExit) as cm:
                import oracle_signup
                oracle_signup.main()
            self.assertEqual(cm.exception.code, 0)

if __name__ == '__main__':
    unittest.main()
