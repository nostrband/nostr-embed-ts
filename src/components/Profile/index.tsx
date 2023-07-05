import { formatNpub, getNpub } from "@src/utils/common.ts";
import CopyText from "@components/CopyText";
import ProfileImage from "@components/ProfileImage";
import {ReactComponent as KeyIcon} from "@assets/icons/key-icon.svg";
import {ReactComponent as NostrichIcon} from "@assets/icons/nostrich-icon.svg";

function Profile({ profilePkey, profile, options }: any) {
    let cachedProfilePicture, encodedProfilePkey, truncatedProfilePkey;
    if (profilePkey) {
        encodedProfilePkey = getNpub(profilePkey);
        truncatedProfilePkey = `${formatNpub(encodedProfilePkey)}`;
        cachedProfilePicture = `https://media.nostr.band/thumbs/${profilePkey.slice(
            -4
        )}/${profilePkey}-picture-64`;
    }

    return (
        <div className="cardProfile">
            {cachedProfilePicture && profile.picture ? (
                <ProfileImage
                    thumbnail={cachedProfilePicture}
                    fullImage={profile.picture}
                />
            ) : (
                <div className="profileWithoutImg" />
            )}
            <div className="profileDetails">
                <div className="profileName">
                    <a
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        href={`https://nostr.band/${encodedProfilePkey}`}
                    >
                        {profile.display_name || profile.name || "Loading..."}
                    </a>
                </div>
                <div className="profilePkey">
                    <KeyIcon className="keyIcon w-4 h-4" />
                    <span className="pkey">{truncatedProfilePkey || "npub..."}</span>
                    <CopyText iconClasses="w-4 h-4" copyText={encodedProfilePkey} />
                </div>
            </div>

            {options && !options.hideNostrich ? (
                <div className="nostrichLink">
                    <a
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        href={`https://heynostr.com`}
                        className="linkLink"
                    >
                        <NostrichIcon className="nostrichIcon w-4 h-4" />
                    </a>
                </div>
            ) : null}
        </div>
    );
}

export default Profile;
