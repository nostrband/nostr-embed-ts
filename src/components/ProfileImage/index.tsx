import { useState } from "react";

function ProfileImage({ thumbnail, fullImage }: any) {
    const [isFullImageLoaded, setIsFullImageLoaded] = useState(false);
    const [imageSrc, setImageSrc] = useState(thumbnail);

    const onError = () => {
        if (!isFullImageLoaded) {
            setImageSrc(fullImage);
            setIsFullImageLoaded(true);
        } else {
            setImageSrc(null);
        }
    };

    return imageSrc ? (
        <img className="profileImg" src={imageSrc} onError={onError} alt='' />
    ) : (
        <div className="profileWithoutImg" />
    );
}

export default ProfileImage;
