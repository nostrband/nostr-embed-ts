import {formatZapAmount, getNoteId} from "@src/utils/common.ts";
import {ReactComponent as CopyText} from "@assets/icons/copy-icon.svg";
import {ReactComponent as BoltIcon} from "@assets/icons/bolt-icon.svg";
import {ReactComponent as HeartIcon} from "@assets/icons/heart-icon.svg";
import {ReactComponent as LinkIcon} from "@assets/icons/link-icon.svg";
import {ReactComponent as ReplyIcon} from "@assets/icons/reply-icon.svg";
import {ReactComponent as RepostIcon} from "@assets/icons/repost-icon.svg";

function Meta({note, profilesList, repliesCount, repostsCount, likesCount, zapAmount, options,}: any) {
    let date, encodedId, formattedDate, formattedZapAmount;

    let createdAt = note
        ? note.created_at
        : profilesList
            ? profilesList.created_at
            : null;
    if (createdAt) {
        date = new Date(createdAt * 1000);
        formattedDate = date.toLocaleTimeString("en-US", {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    if (note && note.id) {
        encodedId = getNoteId(note.id);
    }
    if (profilesList) {
        encodedId = profilesList.id;
    }

    formattedZapAmount = formatZapAmount(zapAmount);

    return (
        <div className="cardMeta">
            <div className="cardDate">{formattedDate}</div>
            <hr/>
            <div className="cardInteractions">
                {options && options.showZaps ? (
                    <div className="interactionContainer" title="Total sats zapped">
                        <BoltIcon className="boltIcon w-5 h-5"/>
                        <span className="zapAmount">{formattedZapAmount}</span>
                    </div>
                ) : null}
                <div className="interactionContainer" title="Number of replies">
                    <ReplyIcon className="replyIcon w-5 h-5"/>
                    <span className="repliesCount">{repliesCount}</span>
                </div>
                <div className="interactionContainer" title="Number of reposts">
                    <RepostIcon className="RepostIcon w-5 h-5"/>
                    <span className="repostsCount">{repostsCount}</span>
                </div>
                <div className="interactionContainer" title="Number of likes">
                    <HeartIcon className="heartIcon w-5 h-5"/>
                    <span className="likesCount">{likesCount}</span>
                </div>
                <div className="interactionContainer">
                    <a
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        href={
                            note
                                ? `https://nostr.band/${encodedId}`
                                : `https://listr.lol/a/${profilesList.naddr}`
                        }
                        className="linkLink"
                    >
                        <LinkIcon className="linkIcon w-5 h-5 hover:text-gray-600"/>
                        <span className="displayText">Open</span>
                    </a>
                </div>
                {options && options.showCopyAddr ? (
                    <div className="interactionContainer">
                        <CopyText
                            className="copyIcon w-5 h-5"
                            // title={note ? "Copy Note ID" : "Copy ID"}
                            // copyText={note ? note : profilesList.naddr}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default Meta;
