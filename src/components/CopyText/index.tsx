import {useState} from 'react';
import {ReactComponent as CopyIcon} from '@assets/icons/copy-icon.svg';

function CopyText({iconClasses, displayText, copyText}: any) {
    const [btnClasses, setBtnClasses] = useState('linkCopyBtn');

    function copyToClipboard() {
        try {
            navigator.clipboard.writeText(copyText);
            setBtnClasses(`${btnClasses} green`);
            setTimeout(() => {
                setBtnClasses(btnClasses.replace('green', '').trim());
            }, 500);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    }

    return (
        <button className={btnClasses} onClick={() => copyToClipboard()}>
            <CopyIcon className={iconClasses + " copyIcon"}/>

            {displayText && <span className="displayText">{displayText}</span>}
            <span className="copyText">{copyText}</span>
        </button>
    );
}

export default CopyText;
