// @ts-nocheck
import * as secp from "@noble/secp256k1";
// @ts-ignore
import {decode} from "light-bolt11-decoder";
import {Component} from "react";
import {
    formatNoteId,
    formatNpub,
    getNoteId,
    getNpub,
    parseNaddr,
    parseNoteId,
    parseNpub,
    parseNprofile,
} from "@src/utils/common";
import Meta from "@components/Meta";
import Profile from "@components/Profile";
import ProfileMeta from "@components/ProfileMeta";

const IMAGE_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VIDEO_FILE_EXTENSIONS = [".mov", ".mp4"];
const YOUTUBE_KEY_WORDS = ["youtube"];

class Home extends Component {
    constructor(props: any) {
        super(props);

        let id = props.id;
        let kind = 1;
        if (props.id?.startsWith("npub1")) {
            id = parseNpub(props.id);
            kind = 0;
        } else if (props.id?.startsWith("note1")) {
            id = parseNoteId(props.id);
        } else if (props.id?.startsWith("naddr")) {
            id = parseNaddr(props.id);
            if (id.data.identifier) {
                kind = 2;
            } else {
                kind = 3;
            }
        }

        this.state = {
            id,
            kind,
            relay: props.relay || 'wss://relay.nostr.band/',
            note: {},
            profile: {},
            profilesList: {},
            taggedProfiles: {},
            profilePkey: "",
            likesCount: 0,
            repostsCount: 0,
            repliesCount: 0,
            zapAmount: 0,
            followersCount: 0,
            countTaggedProfiles: 0,
        };
    }

    sha256(string: string) {
        const utf8 = new TextEncoder().encode(string);
        return secp.utils.sha256(utf8).then((hashBuffer) => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
                .map((bytes) => bytes.toString(16).padStart(2, "0"))
                .join("");
            return hashHex;
        });
    }

    async getNostrEventID(m) {
        const a = [0, m.pubkey, m.created_at, m.kind, m.tags, m.content];
        const s = JSON.stringify(a);
        const h = await this.sha256(s);
        return h;
    }

    verifyNostrSignature(event) {
        return secp.schnorr.verify(event.sig, event.id, event.pubkey);
    }

    async validateNostrEvent(event) {
        if (event.id !== (await this.getNostrEventID(event))) return false;
        if (typeof event.content !== "string") return false;
        if (typeof event.created_at !== "number") return false;

        if (!Array.isArray(event.tags)) return false;
        for (let i = 0; i < event.tags.length; i++) {
            let tag = event.tags[i];
            if (!Array.isArray(tag)) return false;
            for (let j = 0; j < tag.length; j++) {
                if (typeof tag[j] === "object") return false;
            }
        }

        return true;
    }

    async isValidEvent(ev) {
        return (
            ev.id &&
            ev.pubkey &&
            ev.sig &&
            (await this.validateNostrEvent(ev)) &&
            this.verifyNostrSignature(ev)
        );
    }

    componentDidMount() {
        const start = (socket) => {
            switch (this.state.kind) {
                case 0:
                    return this.fetchProfile({socket, profilePkey: this.state.id});
                case 1:
                    return this.fetchNote({socket, noteId: this.state.id});
                case 2:
                    return this.fetchProfilesList({socket, data: this.state.id.data});
                case 3:
                    return this.fetchProfilesList({socket, data: this.state.id.data});
            }
        };

        if (!window.__nostrEmbed) window.__nostrEmbed = {sockets: {}};

        let socket = null;
        if (this.state.relay in window.__nostrEmbed.sockets) {
            socket = window.__nostrEmbed.sockets[this.state.relay];
            if (socket.readyState == 1)
                // open
                start(socket);
            else if (socket.readyState == 0)
                // connecting
                socket.starts.push(start);
            else socket = null;
        }

        if (socket) return;

        socket = new WebSocket(this.state.relay);
        window.__nostrEmbed.sockets[this.state.relay] = socket;

        socket.starts = [start];

        socket.onopen = () => {
            console.log(`Connected to Nostr relay: ${socket.url}`);
            for (const s of socket.starts) s(socket);
            socket.starts = null;
        };

        socket.onerror = (ev) => {
            console.log(`Failed to connect to Nostr relay: ${socket.url}}`);
        };

        const subs = {};
        socket.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (!d || !d.length) throw "Bad reply from relay";

                if (d[0] == "NOTICE" && d.length == 2) {
                    console.log("notice from", socket.url, d[1]);
                    return;
                }

                if (d[0] == "EOSE" && d.length > 1) {
                    if (d[1] in subs) subs[d[1]].on_event(null);
                    return;
                }

                if (d[0] == "COUNT" && d.length == 3) {
                    if (d[1] in subs) subs[d[1]].on_count(d[2]);
                    return;
                }

                if (d[0] != "EVENT" || d.length < 3) throw "Unknown reply from relay";

                if (d[1] in subs) subs[d[1]].on_event(d[2]);
            } catch (error) {
                console.log("relay", socket.url, "bad message", e, "error", error);
                err(error);
            }
        };

        socket.subscribe = ({type, sub, ok, err}) => {
            let id = "embed-" + Math.random();
            const req = [type, id, sub];
            socket.send(JSON.stringify(req));

            const close = () => {
                const sub_id = id;
                id = null;
                socket.send(JSON.stringify(["CLOSE", sub_id]));
                delete subs[sub_id];
            };

            const events = [];
            const queue = [];

            const done = () => {
                if (!id) return;
                clearTimeout(to);
                close();
                ok(events);
            };

            const to = setTimeout(
                function () {
                    // tell relay we're no longer interested
                    close();

                    // maybe relay w/o EOSE support?
                    if (events.length || queue.length) {
                        on_event(null);
                    } else {
                        err("timeout on relay", socket.url);
                    }
                },
                sub.limit && sub.limit == 1 ? 2000 : 6000
            );

            const on_event = async (e) => {
                queue.push(e);
                if (queue.length > 1) return;
                while (queue.length) {
                    e = queue[0];
                    if (e && (await this.isValidEvent(e))) events.push(e);
                    queue.shift(); // dequeue after we've awaited
                    if (!e || (sub.limit && sub.limit == events.length)) {
                        queue.splice(0, queue.length);
                        done();
                        break;
                    }
                }
            };

            const on_count = async (e) => {
                if (type != "COUNT") return; // misbehaving relay
                events.push(e);
                done();
            };

            subs[id] = {ok, err, on_event, on_count};
        };

        socket.listEvents = ({sub, ok, err}) => {
            socket.subscribe({type: "REQ", sub, ok, err});
        };

        socket.countEvents = ({sub, ok, err}) => {
            socket.subscribe({
                type: "COUNT",
                sub,
                ok: (events) => {
                    ok(events.length ? events[0] : null);
                },
                err,
            });
        };
    }

    getEvent({socket, sub, ok, err}) {
        return new Promise((ok, err) => {
            sub.limit = 1;
            socket.listEvents({
                sub,
                ok: (events) => {
                    ok(events ? events[0] : null);
                },
                err,
            });
        });
    }

    listEvents({socket, sub}) {
        return new Promise((ok, err) => {
            socket.listEvents({sub, ok, err});
        });
    }

    countEvents({socket, sub}) {
        return new Promise((ok, err) => {
            socket.countEvents({sub, ok, err});
        });
    }

    fetchNote({socket, noteId}) {
        const sub = {ids: [noteId], kinds: [1]};
        this.getEvent({socket, sub})
            .then((event) => {
                if (event) {
                    this.setState({
                        note: event,
                        profilePkey: event.pubkey,
                    });
                    this.fetchProfile({socket, profilePkey: event.pubkey});
                    this.fetchMeta({socket, noteId});
                    this.fetchTags({socket, tags: event.tags});
                } else {
                    console.log("Error: We can't find that note on this relay");
                    throw "Event not found";
                }
            })
            .catch((error) => {
                console.log(`Error fetching note: ${error}`);
                this.setState({
                    note: {
                        error: true,
                        content:
                            "Sorry, we weren't able to find and parse this note on the specified relay.",
                    },
                });
            });
    }

    fetchProfile({socket, profilePkey}) {
        const sub = {kinds: [0], authors: [profilePkey]};
        this.getEvent({socket, sub})
            .then((event) => {
                if (event) {
                    let parsedProfile = JSON.parse(event.content);
                    parsedProfile.pubkey = profilePkey;
                    this.setState({profile: parsedProfile});
                    if (this.state.kind == 0) {
                        this.fetchProfileMeta({socket, pubkey: profilePkey});
                    }
                } else {
                    throw "Event not found";
                }
            })
            .catch((error) => {
                console.log(`Error fetching profile: ${error}`);
                this.setState({
                    profile: {
                        pubkey: profilePkey,
                        error: true,
                        about:
                            "Sorry, we weren't able to find this profile on the specified relay.",
                    },
                });
            });
    }

    fetchProfilesList({socket, data}) {
        const sub = {
            kinds: [data.kind],
            "#d": [data.identifier],
            authors: [data.pubkey],
        };
        this.getEvent({socket, sub})
            .then((event) => {
                if (event) {
                    let profilesListObj = this.getProfilesListObj(event.tags);
                    profilesListObj.created_at = event.created_at;
                    profilesListObj.id = `${data.kind}:${data.pubkey}:${data.identifier}`;
                    profilesListObj.naddr = this.props.id;
                    this.setState({profilesList: profilesListObj});
                    this.fetchProfile({socket, profilePkey: event.pubkey});
                    this.fetchTags({socket, tags: event.tags});
                    this.fetchMeta({socket, data});
                } else {
                    throw "Event not found";
                }
            })
            .catch((error) => {
                console.log(`Error fetching profileList: ${error}`);
                this.setState({
                    profilesList: {
                        error: true,
                        content:
                            "Sorry, we weren't able to find this profile on the specified relay.",
                    },
                });
            });
    }

    fetchTags({socket, tags}) {
        const sub = {kinds: [0], authors: []};
        let count = 0;

        for (const t of tags) {
            if (sub.authors.length < 100) {
                if (t.length >= 2 && t[0] == "p") {
                    sub.authors.push(t[1]);
                }
            }

            if (t.length >= 2 && t[0] == "p") {
                count++;
            }
        }

        this.setState((state) => ({
            countTaggedProfiles: state.countTaggedProfiles + count,
        }));

        if (!sub.authors.length) return;

        this.listEvents({socket, sub})
            .then((events) => {
                const taggedProfiles = {};
                for (const event of events) {
                    try {
                        let p = JSON.parse(event.content);
                        taggedProfiles[event.pubkey] = p;
                    } catch (e) {
                        console.log("Error bad event content", e, event.content);
                    }
                }
                this.setState({taggedProfiles});
            })
            .catch((error) => {
                console.log(`Error fetching tagged profiles: ${error}`);
            });
    }

    getProfilesListObj(tags) {
        let profilesList = {};

        tags.forEach((tag) => {
            if (tag && tag[0]) {
                if (tag[0] === "name") {
                    profilesList.name = tag[1];
                }
                if (tag[0] === "d") {
                    profilesList.d = tag[1];
                }
                if (tag[0] === "description") {
                    profilesList.description = tag[1];
                }
            }
        });
        return profilesList;
    }

    getZapAmount(e) {
        try {
            for (const t of e.tags) {
                if (t.length >= 2 && t[0] == "bolt11") {
                    const b = decode(t[1]);
                    for (const s of b.sections) {
                        if (s.name == "amount") return parseInt(s.value);
                    }
                    break;
                }
            }
        } catch (er) {
            console.log("Error bad zap", er, e);
        }
        return 0;
    }

    onListMetaEvents(events) {
        for (let noteEvent of events) {
            switch (noteEvent["kind"]) {
                case 6:
                    this.setState((state) => ({
                        repostsCount: state.repostsCount + 1,
                    }));
                    break;
                case 7:
                    this.setState((state) => ({
                        likesCount: state.likesCount + 1,
                    }));
                    break;
                case 1:
                    this.setState((state) => ({
                        repliesCount: state.repliesCount + 1,
                    }));
                    break;
                case 9735:
                    this.setState((state) => ({
                        zapAmount: state.zapAmount + this.getZapAmount(noteEvent),
                    }));
                    break;
                default:
                    console.log("Unknown note kind");
            }
        }
    }

    fetchMeta({socket, noteId, data}) {
        if (socket.url.includes("wss://relay.nostr.band"))
            return this.fetchMetaCount({socket, noteId, data});
        else return this.fetchMetaList({socket, noteId, data});
    }

    fetchMetaCount({socket, noteId, data}) {
        const getSub = (kind) => {
            if (noteId) {
                return {kinds: [kind], "#e": [noteId]};
            }

            if (data) {
                return {
                    kinds: [kind],
                    "#a": [`${data.kind}:${data.pubkey}:${data.identifier}`],
                };
            }
        };

        this.countEvents({socket, sub: getSub(1)}).then((c) => {
            this.setState((state) => ({
                repliesCount: c ? c.count : 0,
            }));
        });
        this.countEvents({socket, sub: getSub(6)}).then((c) => {
            this.setState((state) => ({
                repostsCount: c ? c.count : 0,
            }));
        });
        this.countEvents({socket, sub: getSub(7)}).then((c) => {
            this.setState((state) => ({
                likesCount: c ? c.count : 0,
            }));
        });
        this.listEvents({socket, sub: getSub(9735)}).then((events) => {
            this.onListMetaEvents(events);
        });
    }

    fetchMetaList({socket, noteId, data}) {
        const sub = this.getSubOnFetchMetaList({noteId, data});

        this.listEvents({socket, sub}).then((events) => {
            this.onListMetaEvents(events);
        });
    }

    getSubOnFetchMetaList({noteId, data}) {
        if (noteId) {
            return {kinds: [1, 6, 7, 9735], "#e": [noteId]};
        }
        if (data) {
            return {
                kinds: [1, 6, 7, 9735],
                "#a": [`${data.kind}:${data.pubkey}:${data.identifier}`],
            };
        }
    }

    onListProfileMetaEvents(events) {
        for (let e of events) {
            switch (e["kind"]) {
                case 3:
                    this.setState((state) => ({
                        followersCount: state.followersCount + 1,
                    }));
                    break;
                case 9735:
                    this.setState((state) => ({
                        zapAmount: state.zapAmount + this.getZapAmount(e),
                    }));
                    break;
                default:
                    console.log("Unknown event kind");
            }
        }
    }

    fetchProfileMetaCount({socket, pubkey}) {
        const getSub = (kind) => {
            return {kinds: [kind], "#p": [pubkey]};
        };
        this.countEvents({socket, sub: getSub(3)}).then((c) => {
            this.setState((state) => ({
                followersCount: c ? c.count : 0,
            }));
        });
        this.listEvents({socket, sub: getSub(9735)}).then((events) => {
            this.onListProfileMetaEvents(events);
        });
    }

    fetchProfileMetaList({socket, pubkey}) {
        const sub = {kinds: [3, 9735], "#p": [pubkey]};
        this.listEvents({socket, sub}).then((events) => {
            this.onListProfileMetaEvents(events);
        });
    }

    fetchProfileMeta({socket, pubkey}) {
        if (socket.url.includes("wss://relay.nostr.band"))
            return this.fetchProfileMetaCount({socket, pubkey});
        else return this.fetchProfileMetaList({socket, pubkey});
    }

    formatLink(a) {
        if (this.isVideo(a)) {
            return (
                <div className="cardContentMedia">
                    <video src={a} controls></video>
                </div>
            );
        } else if (this.isImage(a)) {
            return (
                <div className="cardContentMedia">
                    <img className="cardContentImage" src={a} alt=""></img>
                </div>
            );
        } else if (this.isYoutube(a)) {
            if (a.includes("/watch")) {
                a = a.replace("/watch", "/embed");
                a = a.replace("?v=", "/");
            }
            return (
                <div className="cardContentMedia">
                    <iframe src={a}></iframe>
                </div>
            );
        } else {
            return (
                <a target="_blank" rel="noopener noreferrer nofollow" href={a}>
                    {a}
                </a>
            );
        }
    }

    changeLinkRegister(a) {
        return a.toLowerCase();
    }

    splitLink(link, elementNumber) {
        const linkArray = link.split("?");
        if (linkArray.length > elementNumber) {
            return linkArray[elementNumber];
        }
        return link;
    }

    isAnyEndWith(link, extensions) {
        return extensions.some(function (extension) {
            return link.endsWith(extension);
        });
    }

    isAnyContains(link, keyWords) {
        return keyWords.some(function (keyWord) {
            return link.includes(keyWord);
        });
    }

    isImage(a) {
        const link = this.splitLink(this.changeLinkRegister(a), 0);
        return this.isAnyEndWith(link, IMAGE_FILE_EXTENSIONS);
    }

    isVideo(a) {
        const link = this.splitLink(this.changeLinkRegister(a), 0);
        return this.isAnyEndWith(link, VIDEO_FILE_EXTENSIONS);
    }

    isYoutube(a) {
        const link = this.splitLink(this.changeLinkRegister(a), 0);
        return this.isAnyContains(link, YOUTUBE_KEY_WORDS);
    }

    formatContent() {
        if (!this.state.note.content) return "";

        const formatEventLink = (noteOrNaddr) => {
            const label = formatNoteId(noteOrNaddr);
            return (
                <a
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    href={`https://nostr.band/${noteOrNaddr}`}
                >
                    {label}
                </a>
            );
        };

        const formatProfileLink = (npub, pubkey) => {
            let label = formatNpub(npub);
            if (pubkey in this.state.taggedProfiles) {
                const tp = this.state.taggedProfiles[pubkey];
                label = tp?.name || tp?.display_name || label;
            }
            return (
                <a
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    href={`https://nostr.band/${npub}`}
                >
                    @{label}
                </a>
            );
        };

        const note = this.state.note;

        const MentionRegex = /(#\[\d+\])/gi;

        // first - split by #[d] mentions
        const fragments = note.content.split(MentionRegex).map((match) => {
            const matchTag = match.match(/#\[(\d+)\]/);
            if (matchTag && matchTag.length === 2) {
                const idx = parseInt(matchTag[1]);
                if (idx < note.tags.length && note.tags[idx].length >= 2) {
                    const ref = note.tags[idx];
                    switch (ref[0]) {
                        case "p": {
                            return formatProfileLink(getNpub(ref[1]), ref[1]);
                        }
                        case "e": {
                            return formatEventLink(getNoteId(ref[1]));
                        }
                        // not adding support for 'a' - too much code to format the naddr,
                        // and this method is deprecated, so let's hope we won't need this
                        case "t": {
                            return (
                                <a
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    href={`https://nostr.band/?q=%23${ref[1]}`}
                                >
                                    #{ref[1]}
                                </a>
                            );
                        }
                    }
                }

                // unsupported #[d] ref
                return match;
            }

            // now try splitting by nostr: links
            return match.split(/(nostr:[a-z0-9]+)/gi).map((n) => {
                const matchNostr = n.match(/nostr:([a-z0-9]+)/);
                if (matchNostr && matchNostr.length === 2) {
                    if (
                        matchNostr[1].startsWith("note1") ||
                        matchNostr[1].startsWith("nevent1") ||
                        matchNostr[1].startsWith("naddr1")
                    ) {
                        return formatEventLink(matchNostr[1]);
                    } else if (matchNostr[1].startsWith("npub1")) {
                        const npub = matchNostr[1];
                        const pubkey = parseNpub(matchNostr[1]);
                        if (pubkey)
                            return formatProfileLink(npub, pubkey);
                    } else if (matchNostr[1].startsWith("nprofile1")) {
                        const {type, data} = parseNprofile(matchNostr[1]);
                        if (data) {
                            const npub = getNpub(data.pubkey);
                            return formatProfileLink(npub, data.pubkey);
                        }
                    }

                    // unsupported or bad nostr: link
                    return n;
                }

                // finally, split by urls
                const urlRegex =
                    /((?:http|ftp|https):\/\/(?:[\w+?.\w+])+(?:[a-zA-Z0-9~!@#$%^&*()_\-=+\\/?.:;',]*)?(?:[-A-Za-z0-9+&@#/%=~_|]))/i;
                return n.split(urlRegex).map((a) => {
                    if (a.match(/^https?:\/\//)) {
                        return this.formatLink(a);
                    }
                    return a;
                });
            });
        });

        return fragments;
    }

    getDiff() {
        let diff;
        if (
            Object.keys(this.state.taggedProfiles).length > 0 &&
            this.state.countTaggedProfiles
        ) {
            diff =
                this.state.countTaggedProfiles -
                Object.keys(this.state.taggedProfiles).length;
        }
        return diff;
    }

    renderNote() {
        return (
            <div className="nostrEmbedCard">
                <Profile
                    profilePkey={this.state.profilePkey}
                    profile={this.state.profile}
                    options={this.props.options}
                />
                <div
                    className={
                        this.state.note.error
                            ? "cardContent ne-text-red-800"
                            : "cardContent"
                    }
                >
                    {this.formatContent()}
                </div>
                <Meta
                    note={this.state.note}
                    likesCount={this.state.likesCount}
                    repliesCount={this.state.repliesCount}
                    repostsCount={this.state.repostsCount}
                    zapAmount={this.state.zapAmount}
                    options={this.props.options}
                />
            </div>
        );
    }

    renderProfile() {
        return (
            <div className="nostrEmbedCard">
                <Profile
                    profilePkey={this.state.id}
                    profile={this.state.profile}
                    options={this.props.options}
                />
                <div
                    className={
                        this.state.profile.error
                            ? "cardContent ne-text-red-800"
                            : "cardContent"
                    }
                >
                    {this.state.profile?.website ? (
                        <p>
                            Website:{" "}
                            <a
                                href={this.state.profile?.website}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                            >
                                {this.state.profile?.website}
                            </a>
                        </p>
                    ) : (
                        ""
                    )}
                    {this.state.profile?.about || "Loading..."}
                </div>
                <ProfileMeta
                    profile={this.state.profile}
                    followersCount={this.state.followersCount}
                    zapAmount={this.state.zapAmount}
                    options={this.props.options}
                />
            </div>
        );
    }

    renderProfilesList() {
        return (
            <div className="nostrEmbedCard">
                <Profile
                    profilePkey={this.state.id.data.pubkey}
                    profile={this.state.profile}
                    options={this.props.options}
                />
                <div>
                    <h3 className="cardTitle">
                        {this.state.kind === 2 && this.state.profilesList.name
                            ? this.state.profilesList.name
                            : this.state.profilesList.d}
                        {this.state.kind === 3 && "Following "}(
                        {this.state.taggedProfiles ? this.state.countTaggedProfiles : 0})
                    </h3>
                    {this.state.kind === 2 && (
                        <p className="cardDescription">{this.state.profilesList.description}</p>
                    )}
                    <div className="cardList">
                        {Object.keys(this.state.taggedProfiles).map((profilePkey) => {
                            return (
                                <div key={profilePkey + "taggedProfile"}>
                                    <Profile
                                        profilePkey={profilePkey}
                                        profile={this.state.taggedProfiles[profilePkey]}
                                    />
                                </div>
                            );
                        })}
                        {this.state.countTaggedProfiles > 0 &&
                        this.state.countTaggedProfiles >
                        Object.keys(this.state.taggedProfiles).length ? (
                            <div className="diffProfiles">
                                And {this.getDiff()} more profiles.
                            </div>
                        ) : null}
                    </div>
                </div>
                <Meta
                    profilesList={this.state.profilesList}
                    likesCount={this.state.likesCount}
                    repliesCount={this.state.repliesCount}
                    repostsCount={this.state.repostsCount}
                    zapAmount={this.state.zapAmount}
                    options={this.props.options}
                />
            </div>
        );
    }

    render() {
        switch (this.state.kind) {
            case 0:
                return this.renderProfile();
            case 1:
                return this.renderNote();
            case 2:
                return this.renderProfilesList();
            case 3:
                return this.renderProfilesList();
        }
    }
}

export default Home;
