import { addPreSendListener, removePreSendListener } from "@api/MessageEvents";
import definePlugin, { OptionType } from "@utils/types";
import { unshave, UnshaveEntry, dictionary, loadDictionary } from "./unshave";
import { ApplicationCommandInputType, ApplicationCommandOptionType, Argument, CommandContext, CommandReturnValue, findOption, sendBotMessage } from "@api/Commands";
import { Promisable } from "type-fest";
import { DataStore } from "@api/index";
import { filters, waitFor } from "@webpack";
import { createContext, useContext, useState } from '@webpack/common';
import { Flex } from "@components/Flex";
import { makeLazy } from "@utils/lazy";
import { ReactElement } from "react";
import { definePluginSettings } from "@api/Settings";

const DATA_KEY = "unshave_CUSTOM";

let getCustom = () => DataStore.get(DATA_KEY).then<UnshaveEntry[]>(v => v ?? []);
let addCustom = async (entry: UnshaveEntry) => {
    const custom = await getCustom();
    custom.push(entry);
    dictionary.push(entry);
    DataStore.set(DATA_KEY, custom);
    return custom;
};
let removeCustom = async ({ shavian, latin }: Partial<Omit<UnshaveEntry, "occurances">>) => {
    const custom = await getCustom();
    let idx = dictionary.findIndex(v => (shavian ? v.shavian.includes(shavian) : true) && (latin ? v.latin.includes(latin) : true));
    dictionary.splice(idx, 1);
    idx = custom.findIndex(v => (shavian ? v.shavian.includes(shavian) : true) && (latin ? v.latin.includes(latin) : true));
    custom.splice(idx, 1);
    DataStore.set(DATA_KEY, custom);
    return custom;
};

interface TranslationState {
    original: string;
    translation: string;
    legacy_ranges: [number, number][];
}

let getContext = makeLazy(() => createContext({ original: "", translation: "", legacy_ranges: [] as [number, number][] } as TranslationState));
waitFor(filters.componentByCode("renderAttachButton", "renderAppLauncherButton", "renderApplicationCommandIcon"), (m) => {
    let TranslationContext = getContext();
    let render_original = m.type.render;
    m.type.render = function (e: any) {
        let [state, setState] = useState(() => createState(e.textValue as string));
        if (e.textValue != state.original) {
            setState(createState(e.textValue as string));
        }
        return <TranslationContext.Provider value={state}>
            {render_original(...arguments)}
        </TranslationContext.Provider>;
    };
});

let settings = definePluginSettings({
    enableTransliterationBar: {
        type: OptionType.BOOLEAN,
        description: "Enables the transliteration bar, which displays your message with any shavian text transliterated into latin.",
        default: true,
    },
    enableSpellingHighlighting: {
        type: OptionType.BOOLEAN,
        description: "Enables bad spelling highlighting through the ReadLex dictionary. Add to it with the built-in commands.",
        default: true,
    },
    showOriginalShavian: {
        type: OptionType.BOOLEAN,
        description: "Show the original shavian text that you entered in the message output.",
        default: true,
    },
    spoilerOutput: {
        type: OptionType.BOOLEAN,
        description: "Put a spoiler on the resulting transliteration in the message output.",
        default: false,
    },
    dictionary: {
        type: OptionType.STRING,
        description: "ReadLex-style TSV Dictionary",
        default: "https://raw.githubusercontent.com/Shavian-info/readlex/main/kingsleyreadlexicon.tsv",
        onChange(newUrl) {
            (async function () {
                await loadDictionary(newUrl);
            })();
        },
    }
});

export default definePlugin({
    name: "Unshave",
    description: "Transliterate latin messages you send into shavian script. Not the most accurate, but it's passable. " +
        "If you don't like how a word is transliterated, you can overwrite it with /unshave add <shavian> <latin> or use a replacer. " +
        "A replacer is of the form <shavian word>[<latin word>] and can be previewed with the transliteration bar. This plugin does " +
        "not support hyphenated words, and the replacer does not support whitespace.",
    authors: [{ id: 193969178317815810n, name: "Trash Panda" }],
    dependencies: ["MessageEventsAPI"],
    settings,

    commands: [
        {
            name: "unshave",
            description: "Transliterates shavian to latin.",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "add",
                    description: "Add a transliteration for a string of shavian text",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "shavian",
                            description: "The shavian text to transliterate",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                        {
                            name: "latin",
                            description: "The latin text to transliterate to",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                    ],
                },
                {
                    name: "remove",
                    description: "Remove a transliteration for a string of shavian text " +
                        "(NOTE: will not remove entries from the base dictionary, only entries that you have created yourself)",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "shavian",
                            description: "The shavian text to transliterate",
                            type: ApplicationCommandOptionType.STRING,
                        },
                        {
                            name: "latin",
                            description: "The latin text to transliterate to",
                            type: ApplicationCommandOptionType.STRING,
                        },
                    ],
                },
                {
                    name: "search",
                    description: "Find a word from the dictionary",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "query",
                            description: "A string of latin or shavian text",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        }
                    ]
                },
                {
                    name: "mydictionary",
                    description: "Show your personal dictionary",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "page",
                            description: "Which page of your dictionary to show",
                            type: ApplicationCommandOptionType.NUMBER,
                        },
                    ],
                },
            ],
            execute: function (args: Argument[], ctx: CommandContext): Promisable<void | CommandReturnValue> {
                switch (args[0].name) {
                    case "add": {
                        let shavian = findOption<string>(args[0].options, "shavian")!;
                        let latin = findOption<string>(args[0].options, "latin")!;
                        addCustom({ shavian, latin, occurances: Number.MAX_SAFE_INTEGER });
                        break;
                    }
                    case "remove": {
                        let shavian = findOption<string>(args[0].options, "shavian");
                        let latin = findOption<string>(args[0].options, "latin");
                        if (shavian == undefined && latin == undefined) {
                            fancyBotMessage(ctx.channel.id, "𐑧𐑮𐑼 ||Error||", "𐑥𐑱𐑒 𐑖𐑫𐑼 𐑞𐑨𐑑 𐑿 𐑣𐑨𐑝 𐑿𐑟𐑛 𐑨𐑑 𐑤𐑰𐑕𐑑 𐑢𐑳𐑯 𐑪𐑐𐑖𐑩𐑯.\n||Make sure that you have used at least one option.||");
                            break;
                        }
                        removeCustom({ shavian, latin });
                        break;
                    }
                    case "search": {
                        let query = findOption<string>(args[0].options, "query")!;
                        let isLatin = false;
                        let entries = dictionary
                            .filter(v => (isLatin = true, v.latin.includes(query)) || v.shavian.includes(query))
                            .sort((a, b) =>
                                a.latin == query || a.shavian == query ? -1 :
                                    isLatin
                                        ? (a.latin.indexOf(query) - b.latin.indexOf(query))
                                        : (a.shavian.indexOf(query) - b.shavian.indexOf(query)))
                            .map(v => ({
                                latin: v.latin.replace(query, "**" + query + "**"),
                                shavian: v.shavian.replace(query, "**" + query + "**"),
                                occurances: v.occurances,
                            } as UnshaveEntry));

                        sendBotMessage(ctx.channel.id, {
                            embeds: [
                                {
                                    //@ts-ignore
                                    title: `𐑛𐑦𐑒𐑖𐑩𐑯𐑼𐑦 𐑕𐑻𐑗 𐑓 "${query}" ||Dictionary search for||`,
                                    description: entries.map(v => `${v.latin}: ${v.shavian}`).slice(0, 10).join("\n"),
                                    //@ts-ignore
                                    color: 0x7fd77f,
                                    type: "rich",
                                }
                            ],
                            author: {
                                bot: true,
                                username: "𐑳𐑯𐑖𐑱𐑝 (Unshave)",
                            },
                        });

                        break;
                    }
                    case "mydictionary": {
                        let page_number = findOption<number>(args[0].options, "page", 1);
                        getCustom().then(entries => {
                            let page_start = (page_number - 1) * 10;
                            let page_end = Math.min(page_start + 10, entries.length);
                            let page = entries.slice(page_start, page_end);
                            let npages = Math.ceil(entries.length / 10);

                            fancyBotMessage(ctx.channel.id, `𐑐𐑲𐑡 ${page_number}/${npages} (Page)`,
                                page.map(v => `${v.shavian}: ${v.latin}`).join("\n")
                            );
                        });
                        break;
                    }
                }
            }
        }
    ],

    patches: [
        {
            find: "\"ChannelTextAreaBars\"",
            replacement: {
                match: /"ChannelTextAreaBars"\}\),(\i)=\[\];/g,
                replace: "\"ChannelTextAreaBars\"}),$1=[];$self.addBars($1);",
            },
        },
    ],

    async start() {
        await loadDictionary(settings.store.dictionary);
        dictionary.push(...(await getCustom()));
        this.preSend = addPreSendListener((_, msg) => {
            let { original, unshaved } = unshave(msg.content);
            if (unshaved !== original) {
                let result = "";
                if (settings.store.showOriginalShavian) {
                    result += `${original.trim()}\n> `;
                    if (settings.store.spoilerOutput) {
                        unshaved = `||${unshaved.trim()}||`;
                    }
                }
                result += unshaved;

                msg.content = result;
            }
        });
    },

    stop() {
        removePreSendListener(this.preSend);
    },

    addBars(bars: any[]) {
        let { enableTransliterationBar, enableSpellingHighlighting } = settings.use(["enableTransliterationBar", "enableSpellingHighlighting"]);
        if (!enableTransliterationBar) {
            return;
        }

        let { original, translation, legacy_ranges } = useContext(getContext());
        if (original == translation) {
            return;
        }

        let formatted: ReactElement[] = [];
        if (enableSpellingHighlighting) {
            let colorize = false;
            let last_index = 0;
            for (let end_index of [...legacy_ranges.flat(), translation.length]) {
                formatted.push(
                    <span style={{ color: colorize ? "#faa" : undefined }}>
                        {translation.substring(last_index, end_index)}
                    </span>
                );
                last_index = end_index;
                colorize = !colorize;
            }
        } else {
            formatted = [<span>{translation}</span>];
        }
        bars.push(
            <Flex style={{ padding: "0.45rem 1rem", lineHeight: "1.5rem", color: "white", gap: "1rem", alignItems: "center" }}>
                <span>{formatted}</span>
            </Flex>
        );
    }
});

function createState(text: string): TranslationState {
    let { unshaved: translation, legacy_ranges } = unshave(text);
    return {
        original: text,
        translation,
        legacy_ranges
    };
}

function fancyBotMessage(channel: string, title: string, message: string) {
    sendBotMessage(channel, {
        embeds: [
            {
                //@ts-ignore
                title: title,
                description: message,
                //@ts-ignore
                color: 0x7fd77f,
                type: "rich",
            }
        ],
        author: {
            bot: true,
            username: "𐑳𐑯𐑖𐑱𐑝 (Unshave)",
        },
    });
}
