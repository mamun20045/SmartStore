import React, { useEffect, useRef } from 'react';

interface AdsterraBannerProps {
  id: string;
  height: number;
  width: number;
  atKey: string;
  adCode?: string;
}

const AdsterraBanner: React.FC<AdsterraBannerProps> = ({ id, height, width, atKey, adCode }) => {
  if (!atKey && !adCode) return null;

  let adHtml = '';
  
  if (adCode) {
    // Inject the provided code directly
    adHtml = `
      <html>
        <body style="margin:0; padding:0; display:flex; align-items:center; justify-content:center; background: transparent;">
          ${adCode}
        </body>
      </html>
    `;
  } else {
    // Generate from key
    adHtml = `
      <html>
        <body style="margin:0; padding:0; display:flex; align-items:center; justify-content:center; background: transparent;">
          <script type="text/javascript">
            atOptions = {
              'key' : '${atKey}',
              'format' : 'iframe',
              'height' : ${height},
              'width' : ${width},
              'params' : {}
            };
          </script>
          <script type="text/javascript" src="//www.topcreativeformat.com/${atKey}/invoke.js"></script>
        </body>
      </html>
    `;
  }

  return (
    <iframe
      id={id}
      title="AdBanner"
      srcDoc={adHtml}
      width={width}
      height={height}
      style={{ border: 'none', overflow: 'hidden', background: 'transparent' }}
      scrolling="no"
    />
  );
};

export default AdsterraBanner;
