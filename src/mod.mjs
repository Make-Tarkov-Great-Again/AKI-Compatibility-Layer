
const MOD_PATH = `user/mods/AKI-Compatibility-Layer/src/`;
import pkg from 'typescript';
const { ScriptTarget, ModuleKind, transpileModule } = pkg;


class Mod {

    async initialize() {
        this.container = {
            resolve: (name) => {
                return this.container[name];
            },
        };

        await Promise.allSettled([
            await this.setLoaders(),
            await this.setImporterUtils(),
            await this.setWinstonLogger(),
            await this.setJsonUtil(),
            await this.setBundleLoader(),
            await this.setVFS(),
            await this.setDatabaseServer(),
        ]);

        this.toolkit = {
            refactorAkiMod: async (modPath) => { return this.refactorAkiMod(modPath) }
        };
        return {
            container: this.container,
            toolkit: this.toolkit,
        };
    }

    async setWinstonLogger() {
        this.container["logger"] = {
            debug: (data, _onlyShowInConsole = false) => {
                return this.utilities.logger.debug(data);
            },
            error: (data) => {
                return this.utilities.logger.error(data);
            },
            success: (data) => {
                return this.utilities.logger.info(data);
            },
            info: (data) => {
                return this.utilities.logger.info(data);
            },
            warn: (data) => {
                return this.utilities.logger.warn(data);
            },
            logWithColor: (data, _textColor = null, _backgroundColor = null) => {
                return this.utilities.logger.info(data);
            },
            log: (data, _textColor = null, _backgroundColor = null) => {
                return this.utilities.logger.info(data);
            }
        }
    }

    async setJsonUtil() {
        this.container["JsonUtil"] = {};
    }

    async setBundleLoader() {
        this.container["BundleLoader"] = {
            addBundles: (path) => { return this.database.bundles.push(path) }
        };
    }

    async setVFS() {
        this.container["VFS"] = {
            exists: (path) => { return this.utilities.fileExist(path, true) }
        };
    }

    async setDatabaseServer() {
        const databaseServer = this.container;
        const database = this.database;
        //const PATH = this.utilities.getAbsolutePathFrom(`${MOD_PATH}output.json`);
        //const bigData = await this.utilities.readParsed(PATH);

        const formatLocales = () => {
            const global = {};
            const languages = database.languages;
            const menu = {};

            for (const lang in database.locales) {
                const language = database.locales[lang];
                global[lang] = language.locale;
                menu[lang] = language.menu;
            }
            return { global, languages, menu };
        }

        const formatTraders = () => {
            const traders = {};

            for (const id in database.traders) {
                const trader = database.traders[id];
                traders[id] = {};

                if (trader.base)
                    traders[id].base = trader.base;
                if (trader.baseAssort)
                    traders[id].assort = trader.baseAssort;
                if (trader.questassort)
                    traders[id].questassort = trader.questassort;
                if (trader.suits)
                    traders[id].suits = trader.suits;
                if (trader.dialogue)
                    traders[id].dialogues = trader.dialogue;
            }
            return traders;
        }


        const DATABASE_SERVER = {
            globals: database.core.globals,
            templates: {
                items: database.items,
                customization: database.customization,
                prices: database.templates.priceTable,
                quests: database.quests,
                handbook: database.templates.Handbook,
                repeatableQuests: false, //not implemented
                profiles: false, //database.editions flattened
            },
            traders: formatTraders(),
            locations: database.locations, //looseLoot = dynamicAvailableSpawns,
            locales: formatLocales()

        }
        databaseServer["DatabaseServer"] = {
            DATABASE_SERVER,
            getTables: () => { return DATABASE_SERVER }
        }
    }

    async setLoaders() {
        const loader = this.container;
        const loaderType = ["PreAkiModLoader", "PostAkiModLoader", "PostDBModLoader"];
        const functions = this.getLoaderFunctions();

        for (const type of loaderType) {
            loader[type] = functions;
        }
    }

    getLoaderFunctions() {
        return {
            getModPath: (modName) => {
                return `user/mods/${modName}/`
            }
        }
    }

    async setImporterUtils() {
        const importer = this.container;
        const loadRecursiveAsync = async (dir) => { return loadRecursive(dir) };
        const loadRecursive = async (dir) => {
            const fs = await import('fs');
            const path = await import('path');

            let files = {};
            const dirContent = fs.readdirSync(dir);
            for (let i = 0, LENGTH = dirContent.length; i < LENGTH; i++) {
                const filePath = path.join(dir, dirContent[i]);
                const fileName = dirContent[i].replace(".json", "");
                if (fs.statSync(filePath).isDirectory()) {
                    files[fileName] = await loadRecursiveAsync(filePath);
                } else {
                    files[fileName] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
            }
            return files;
        }

        importer["ImporterUtil"] = {
            loadRecursive,
            loadRecursiveAsync
        }

    }

    async refactorAkiMod(modPath) {
        const files = await this.utilities.readdir(modPath);
        const regex = /bundle|\.json|\.md|\.png|\.txt/;
        const snapshotPath = "C:/snapshot/project/obj";
        const sptPath = "@spt-aki/"
        const replacedPath = (modPath.includes("/src") ? "../../" : "../") + "AKI-Compatibility-Layer/src";

        for (const file of files) {
            if (regex.test(file)) continue;

            const newPath = `${modPath}/${file}`;
            if (await this.utilities.isDirectory(newPath)) {
                await this.refactorAkiMod(newPath);
            }

            const readFile = await this.utilities.read(newPath, false);
            let replaced = readFile.toString();
            if (file.includes(".js") && replaced.includes(snapshotPath)) {
                replaced = replacePath(readFile.toString(), snapshotPath, replacedPath);
                writeBackup(newPath, readFile.toString());
                await this.utilities.write(newPath, replaced);
            } else if (file.includes(".ts") && replaced.includes(sptPath)) {
                replaced = replacePath(readFile.toString(), sptPath, replacedPath);
                const compiler = transpileModule(replaced, getConfig(modPath));
                await this.utilities.write(newPath.replace(".ts", ".js"), compiler.outputText);
                console.log("im a fat faggot");
            }
        }
    }

    static replacePath(str, oldPath, newPath) {
        let replaced = str.replace(oldPath, newPath);
        while (replaced.includes(oldPath)) {
            replaced = replaced.replace(oldPath, newPath);
        }
        return replaced;
    }

    static writeBackup(path, content) {
        return this.utilities.write(path.replace(".js", "_old.js"), content);
    }

    static getConfig(modPath) {
        return {
            compilerOptions: {
                noEmitOnError: true,
                noImplicitAny: false,
                target: ScriptTarget.ES2020,
                module: ModuleKind.CommonJS,
                resolveJsonModule: true,
                allowJs: true,
                esModuleInterop: true,
                downlevelIteration: true,
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                rootDir: modPath,
                isolatedModules: true
            }
        }
    }

}
export const mod = new Mod();