import fs from 'fs';
import path from 'path';

const modules: string[] = [];
const dependencies: Record<string, {order: number; deps: string[]}> = {};
for (const item of fs.readdirSync('./modules')) {
  const itemPath = path.join('./modules', item);
  if (fs.statSync(itemPath).isDirectory()) {
    const packageFile = path.join(itemPath, 'package.json');
    const tsconfigFile = path.join(itemPath, 'tsconfig.json');
    if (!fs.existsSync(packageFile)) {
      // Not a package
      continue;
    }

    modules.push(itemPath);

    const tsconfigContent = fs.readFileSync(tsconfigFile, 'utf8').replace(/\/\/.*/gm, '');
    const tsconfig = JSON.parse(tsconfigContent);
    dependencies[itemPath] = {
      order: -1,
      deps: ((tsconfig.references || []) as {path: string}[]).map((d) =>
        path.join(itemPath, d.path)
      )
    };
  }
}

for (const key in dependencies) {
  resolveOrder(key);
}

console.log(modules.sort((k1, k2) => dependencies[k1].order - dependencies[k2].order).join(' '));

function resolveOrder(key: string) {
  const item = dependencies[key];
  if (item.order >= 0) {
    return item.order;
  }
  const order: number =
    dependencies[key].deps.reduce((max: number, d: string) => {
      return Math.max(max, resolveOrder(d));
    }, -1) + 1;
  item.order = order;
  return order;
}
