import { addPreSendListener, removePreSendListener } from "@api/MessageEvents";
import definePlugin from "@utils/types";
import { unshave, UnshaveEntry, dictionary } from "./unshave";
import { ApplicationCommandInputType, ApplicationCommandOptionType, Argument, CommandContext, CommandReturnValue, findOption, sendBotMessage } from "@api/Commands";
import { Promisable } from "type-fest";
import { DataStore } from "@api/index";
import { filters, waitFor } from "@webpack";
import { createContext, useContext, useState } from '@webpack/common';
import { Flex } from "@components/Flex";
import { makeLazy } from "@utils/lazy";
import { ReactElement } from "react";

const DATA_KEY = "unshave_CUSTOM";

let getCustom = () => DataStore.get(DATA_KEY).then<UnshaveEntry[]>(v => v ?? []);
let addCustom = async (entry: UnshaveEntry) => {
    const custom = await getCustom();
    custom.push(entry);
    dictionary.push(entry);
    DataStore.set(DATA_KEY, custom);
    return custom;
};
let removeCustom = async (entry: UnshaveEntry) => {
    const custom = await getCustom();
    let idx = dictionary.findIndex((v) => v.shavian == entry.shavian && v.latin == entry.latin);
    dictionary.splice(idx, 1);
    idx = custom.findIndex((v) => v.shavian == entry.shavian && v.latin == entry.latin);
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

export default definePlugin({
    name: "Unshave",
    description: "Unshave messages you send.",
    authors: [{ id: 193969178317815810n, name: "Trash Panda" }],
    dependencies: ["MessageEventsAPI"],

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
                    description: "Remove a transliteration for a string of shavian text",
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
            ],
            execute: function (args: Argument[], ctx: CommandContext): Promisable<void | CommandReturnValue> {
                switch (args[0].name) {
                    case "add": {
                        let shavian = findOption(args[0].options, "shavian", "");
                        let latin = findOption(args[0].options, "latin", "");
                        addCustom({ shavian, latin, occurances: Number.MAX_SAFE_INTEGER });
                        break;
                    }
                    case "remove": {
                        let shavian = findOption(args[0].options, "shavian", "");
                        let latin = findOption(args[0].options, "latin", "");
                        removeCustom({ shavian, latin, occurances: 0 });
                        break;
                    }
                    case "search": {
                        let query = findOption(args[0].options, "query", "!!!!!");
                        let entries = dictionary
                            .filter(v => v.latin.includes(query) || v.shavian.includes(query))
                            .sort((a, b) =>
                                a.latin.includes(query)
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
                                    title: `Dictionary search for ${query}`,
                                    description: entries.map(v => `${v.latin}: ${v.shavian}`).slice(0, 10).join("\n"),
                                    //@ts-ignore
                                    color: 0x7fd77f,
                                    type: "rich"
                                }
                            ]
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
        dictionary.push(...(await getCustom()));
        this.preSend = addPreSendListener((_, msg) => {
            let { original, unshaved } = unshave(msg.content);
            if (unshaved !== original) {
                msg.content = `${original.trim()}\n> ${unshaved.trim()}`;
            } else {
                msg.content = unshaved;
            }
        });
    },

    stop() {
        removePreSendListener(this.preSend);
    },

    addBars(bars: any[]) {
        let { original, translation, legacy_ranges } = useContext(getContext());
        if (original == translation) {
            return;
        }
        let formatted: ReactElement[] = [];
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
        bars.push(
            <Flex style={{ padding: "0.45rem 1rem", lineHeight: "16px", color: "white", gap: "1rem", alignItems: "center" }}>
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
