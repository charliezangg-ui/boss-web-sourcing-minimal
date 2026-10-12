import argparse, json, pathlib, subprocess
p=argparse.ArgumentParser()
p.add_argument("--space",type=int,required=True)
p.add_argument("--page",required=True)
p.add_argument("--output",required=True)
a=p.parse_args()
output=pathlib.Path(a.output).resolve()
package_root=pathlib.Path(__file__).resolve().parents[3]
if output.is_relative_to(package_root):p.error('Write candidate artifacts to a private run directory outside the skill package')
if output.exists():p.error('Existing capture: inspect it instead of overwriting')
config={"spaceId":a.space,"pageLabel":a.page,"outputPath":str(output)}
source="globalThis.bossResumeCapture="+json.dumps(config)+";\n"+pathlib.Path(__file__).with_name("capture-full-resume.mjs").read_text()
r=subprocess.run(["ego-browser","nodejs"],input=source,text=True)
raise SystemExit(r.returncode)
