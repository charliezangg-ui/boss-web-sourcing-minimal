import unittest,importlib.util,pathlib
s=importlib.util.spec_from_file_location('c',pathlib.Path(__file__).with_name('checkpoint.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_serial(self):
  s=m.transition({},dict(event='begin',candidate_key='a',unread_evidence='h'),1)
  with self.assertRaises(ValueError):m.transition(s,dict(event='begin',candidate_key='b',unread_evidence='h'),2)
 def test_no_replay(self):
  s=m.transition({},dict(event='begin',candidate_key='a',unread_evidence='h'),1)
  s=m.transition(s,dict(event='complete',candidate_key='a',decision='insufficient',evidence='x'),3)
  self.assertEqual(s['candidates']['a']['total_seconds'],2)
  with self.assertRaises(ValueError):m.transition(s,dict(event='begin',candidate_key='a',unread_evidence='h'),4)
 def test_unread_required(self):
  with self.assertRaises(ValueError):m.transition({},dict(event='begin',candidate_key='a'),1)
 def test_resume_waiting_without_reopening_all_read(self):
  s=m.transition({},dict(event='begin',candidate_key='a',unread_evidence='h',run_id='r',role_ref='j'),1)
  s=m.transition(s,dict(event='complete',candidate_key='a',decision='fit',evidence='x',outcome='waiting_resume'),2)
  s=m.transition(s,dict(event='resume',candidate_key='a',run_id='r',role_ref='j',recovery_evidence='new inbound'),3)
  self.assertEqual(s['candidates']['a']['status'],'processing')
  with self.assertRaises(ValueError):m.transition(s,dict(event='resume',candidate_key='a',run_id='wrong',role_ref='j',recovery_evidence='x'),4)
if __name__=='__main__':unittest.main()
