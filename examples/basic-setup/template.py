from os import listdir
from os.path import isfile, join
import json

template_folder = 'assets/templates'

def get_templates(base_folder, current_dir='', files=None):
    if files is None:
        files = []

    this_dir = join(base_folder, current_dir)

    for f in listdir(this_dir):
        if isfile(join(this_dir, f)) and f[-5:] == '.html':
            files.append(join(current_dir, f))
        elif not isfile(join(this_dir, f)) and f[:1] != '.':
            get_templates(base_folder, join(current_dir, f), files)

    return files

json_file = False

with open(join(template_folder,'forms.json'), 'r') as f:
    json_file = json.loads(f.read())

if not json_file:
    print 'forms.json FAIL'
    exit()

json_file['templates'] = {}
templates = []

for f in listdir(template_folder):
    if not isfile(join(template_folder, f)) and f[:1] != '.':
        templates.append(f)

for template in templates:
    template_path = join(template_folder, template)
    files = get_templates(template_path)
    if len(files) > 0:
        json_file['templates'][template] = {}
        for file in files:
            with open(join(template_path, file), 'r') as f:
                json_file['templates'][template][file[:-5]] = f.read()

with open(join(template_folder,'templates.json'),'w') as f:
    f.write(json.dumps(json_file))
