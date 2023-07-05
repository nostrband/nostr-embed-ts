import { formatZapAmount, getNpub } from "@src/utils/common.ts";
import CopyText from "@components/CopyText";
import {ReactComponent as BoltIcon} from "@assets/icons/bolt-icon.svg";
import {ReactComponent as FollowersIcon} from "@assets/icons/followers-icon.svg";
import {ReactComponent as LinkIcon} from "@assets/icons/link-icon.svg";

function ProfileMeta({ profile, followersCount, zapAmount, options }: any) {
    let npub, formattedZapAmount;

    if (profile && profile.pubkey) {
        npub = getNpub(profile.pubkey);
        formattedZapAmount = formatZapAmount(zapAmount);
    }

    return (
        <div className="cardMeta">
            <hr />
            <div className="cardInteractions">
                {options && options.showZaps ? (
                    <div className="interactionContainer" title="Total sats zapped">
                        <BoltIcon className="boltIcon w-5 h-5" />
                        <span className="zapAmount">{formattedZapAmount}</span>
                    </div>
                ) : null}
                <div className="interactionContainer" title="Number of followers">
                    <FollowersIcon className="followersIcon w-5 h-5" />
                    <span className="followersCount">{followersCount}</span>
                </div>
                <div className="interactionContainer">
                    <a target="_blank" rel="noopener noreferrer nofollow" href={`https://nostr.band/${npub}`}
                       className="linkLink">
                        <LinkIcon className="linkIcon w-5 h-5 hover:text-gray-600" />
                        <span className="displayText">Open</span>
                    </a>
                </div>
                {options && options.showCopyAddr ? (
                    <div className="interactionContainer">
                        <CopyText
                            iconClasses="w-5 h-5"
                            displayText="Copy Npub"
                            copyText={npub}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default ProfileMeta;
