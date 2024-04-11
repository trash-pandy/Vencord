import { addPreSendListener, removePreSendListener } from "@api/MessageEvents";
import definePlugin from "@utils/types";
import { Unshave, UnshaveEntry } from "./unshave";
import { ApplicationCommandInputType, ApplicationCommandOptionType, Argument, CommandContext, CommandReturnValue, findOption, sendBotMessage } from "@api/Commands";
import { Promisable } from "type-fest";
import { DataStore } from "@api/index";
import { filters, waitFor } from "@webpack";
import { createContext, useContext, useState } from '@webpack/common';
import { Flex } from "@components/Flex";
import { makeLazy } from "@utils/lazy";

let unshave = new Unshave();
const DATA_KEY = "unshave_CUSTOM";

let getCustom = () => DataStore.get(DATA_KEY).then<UnshaveEntry[]>(v => v ?? []);
let addCustom = async (entry: UnshaveEntry) => {
    const custom = await getCustom();
    custom.push(entry);
    unshave.entries.push(entry);
    DataStore.set(DATA_KEY, custom);
    return custom;
};
let removeCustom = async (entry: UnshaveEntry) => {
    const custom = await getCustom();
    let idx = unshave.entries.findIndex((v) => v.shavian == entry.shavian && v.latin == entry.latin);
    unshave.entries.splice(idx, 1);
    idx = custom.findIndex((v) => v.shavian == entry.shavian && v.latin == entry.latin);
    custom.splice(idx, 1);
    DataStore.set(DATA_KEY, custom);
    return custom;
};

let getContext = makeLazy(() => createContext({ original: "", translation: "" }));
waitFor(filters.componentByCode("renderAttachButton", "renderAppLauncherButton", "renderApplicationCommandIcon"), (m) => {
    let TranslationContext = getContext();
    let render_original = m.type.render;
    m.type.render = function (e: any) {
        let [state, setState] = useState({ original: e.textValue, translation: "" });
        if (e.textValue != state.original) {
            setState({
                original: e.textValue,
                translation: unshave.process(e.textValue)[1],
            });
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
                        let entries = unshave.entries
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
        await unshave.load();
        unshave.entries.push(...(await getCustom()));
        this.preSend = addPreSendListener((_, msg) => {
            let [original, unshaved] = unshave.process(msg.content);
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
        let state = useContext(getContext());
        if (state.original == state.translation) {
            return;
        }
        bars.push(
            <Flex style={{ padding: "0.45rem 1rem", lineHeight: "16px", color: "white", gap: "1rem", alignItems: "center" }}>
                <span>{state.translation}</span>
            </Flex>
        );
    }
});
