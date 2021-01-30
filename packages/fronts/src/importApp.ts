import semver from 'semver';
import { injectScript } from './injectScript';

const getContainer = (name: string) => (window as Record<string, any>)[name];

const getDepLink = (versionsMap: Record<string, string>, version: string) => {
  // TODO: use semver for version pick
  return versionsMap[version];
};

const loadModuleScript = (name: string, url: string) => {
  return new Promise((resolve, reject) => {
    const container = getContainer(name);
    if (typeof container !== 'undefined') {
      // Script have already been loaded.
      return resolve(null);
    }
    injectScript({
      url,
      reject,
      resolve,
    });
  });
};

export const getModule = async (name: string, module: string) => {
  // Initializes the share scope. This fills it with known provided modules from this build and all remotes
  await __webpack_init_sharing__('default');
  const container = getContainer(name); // or get the container somewhere else
  // Initialize the container, it may provide shared modules
  await container.init(__webpack_share_scopes__.default);
  const factory = await container.get(module);
  return factory();
};

export const importApp = async (path: string) => {
  const [name, ...paths] = path.split('/');
  const modulePath = `./${paths.join('/')}`;
  if (typeof process.env.FPM_MAP === 'string') {
    try {
      const frontsPackagesMap = JSON.parse(process.env.FPM_MAP);
      const depInfo = frontsPackagesMap[name];
      const isExternalLink = /^(http|https):/.test(depInfo);
      if (isExternalLink) {
        await loadModuleScript(name, depInfo);
      } else {
        // TODO: use cache
        const data: Record<string, Record<string, string>> = await fetch(
          `${process.env.FPM_REG}?scope=${name}`
        ).then((data) => data.json());
        const depLink = getDepLink(data[name], depInfo);
        await loadModuleScript(name, depLink);
      }
      const module = await getModule(name, modulePath);
      return module;
    } catch (e) {
      console.error(
        `Failed to import module ${modulePath} of application ${name} from registry ${process.env.FPM_REG}:`
      );
      throw e;
    }
  }
};