import importlib.util, pathlib, unittest, tempfile
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('reader',pathlib.Path(__file__).with_name('read.py')); reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
class CoverageTests(unittest.TestCase):
    def test_compiled_cache_reuses_and_invalidates(self):
        with tempfile.TemporaryDirectory() as root:
            source=pathlib.Path(root)/'source.swift';source.write_text('v1')
            def compile_stub(argv, **kwargs):pathlib.Path(argv[-1]).write_text('binary')
            with patch.object(reader.subprocess,'run',side_effect=compile_stub) as run:
                first=reader.ocr_command(source,pathlib.Path(root)/'cache')
                self.assertEqual(reader.ocr_command(source,pathlib.Path(root)/'cache'),first)
                self.assertEqual(run.call_count,1)
                source.write_text('v2')
                self.assertNotEqual(reader.ocr_command(source,pathlib.Path(root)/'cache'),first)
                self.assertEqual(run.call_count,2)
    def test_stderr_payload(self):self.assertEqual(reader.parse_payload('', '[notice]\n{"status":"card_read"}')['status'],'card_read')
    def test_noise_not_payload(self):
        with self.assertRaises(ValueError):reader.parse_payload('{"notice":"update"}','')
    def test_empty_never_passes(self):self.assertEqual(reader.validate_ocr([], '甲')['status'],'blocked_read')
    def test_wrong_candidate_never_passes(self):self.assertEqual(reader.validate_ocr([{'text':'乙'},{'text':'在线浏览牛人简历'}], '甲')['status'],'needs_visual_check')
    def test_clipped_never_passes(self):self.assertEqual(reader.validate_ocr([{'text':'甲'},{'text':'工作经历'}], '甲')['status'],'needs_visual_check')
    def test_full_read(self):self.assertEqual(reader.validate_ocr([{'text':'甲'},{'text':'工作经历'},{'text':'在线浏览牛人简历'}], '甲')['status'],'ready_for_review')
    def test_folded_needs_review(self):self.assertEqual(reader.validate_ocr([{'text':'甲 查看全部'},{'text':'在线浏览牛人简历'}], '甲')['status'],'needs_visual_check')
if __name__=='__main__':unittest.main()
