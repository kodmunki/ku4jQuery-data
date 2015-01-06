function imageFileField(selector) {
    imageFileField.base.call(this, selector);
}

imageFileField.prototype = {
    maxDims: function(value) { return this.property("maxDims", $.point.parse(value)); },
    $readFiles: function(func, scp) {
        var files = $.list(this.files()),
            maxDims = this._maxDims,
            resizedFiles = $.list(),
            fileCount = this.fileCount(),
            scope = scp || this;

        if(!$.exists(maxDims) || files.isEmpty()) func.call(scope, this.files());
        else
        {
            function callback() { func.call(scope, resizedFiles.toArray()); }

            files.each(function (file) {

                var image = document.createElement("img"),
                    sourceCanvas = document.createElement("canvas"),
                    sourceContext = sourceCanvas.getContext("2d"),
                    reader = new FileReader();

                reader.onload = function (e) {
                    fileCount --;

                    image.src = e.target.result;
                    image.onload = function() {

                        sourceContext.drawImage(image, 0, 0);

                        var exif = get_exif_data(e.target.result),
                            orientation = exif.Orientation,
                            maxRect = $.rectangle($.point.zero(), maxDims),
                            imageWidth = ($.exists(image.naturalWidth)) ? image.naturalWidth : image.width,
                            imageHeight = ($.exists(image.naturalHeight)) ? image.naturalHeight : image.height,
                            imageRect = $.rectangle($.point.zero(), $.point(imageWidth, imageHeight)),
                            aspectDims = imageRect.aspectToFit(maxRect).dims(),
                            aspectWidth = aspectDims.x(),
                            aspectHeight = aspectDims.y(),
                            aspectCanvasWidth = (orientation == 6 || orientation == 8) ? aspectHeight : aspectWidth,
                            aspectCanvasHeight = (orientation == 6 || orientation == 8) ? aspectWidth : aspectHeight,
                            aspectCanvas = document.createElement("canvas");

                        aspectCanvas.width = aspectCanvasWidth;
                        aspectCanvas.height = aspectCanvasHeight;

                        var aspectContext = aspectCanvas.getContext("2d");

                        if(!$.isNumber(orientation) || orientation == 1) {
                            aspectContext.drawImage(image, 0, 0, aspectWidth, aspectHeight);
                        }
                        else {
                            var radians = Math.PI/180, rotation;

                            switch (orientation) {
                                case 3: rotation = 180 * radians; break;
                                case 6: rotation = 90 * radians; break;
                                case 8: rotation = -90 * radians; break;
                                default: rotation = 0;
                            }
                            aspectContext.translate(aspectCanvasWidth/2, aspectCanvasHeight/2);
                            aspectContext.rotate(rotation);
                            aspectContext.drawImage(image, -aspectCanvasHeight/2, -aspectCanvasWidth/2, aspectWidth, aspectHeight);
                        }

                        var dataUrl = aspectCanvas.toDataURL("image/png"),
                            blob = dataUriToBlob(dataUrl);

                        blob.lastModified = file.lastModified;
                        blob.lastModifiedDate = file.lastModifiedDate;
                        blob.name = file.name;

                        resizedFiles.add(blob);
                        if (fileCount < 1) callback();
                    }
                };
                reader.readAsDataURL(file);
            });
        };
    }


};
$.Class.extend(imageFileField, field);
$.imageFileField = function(selector){ return new imageFileField(selector); };
$.imageFileField.Class = imageFileField;

function dataUriToBlob(dataUri) {
    //NOTE: Convert base64/URLEncoded data component to raw binary data held in a string

    var byteString;
    if (dataUri.split(',')[0].indexOf('base64') >= 0)
        byteString = $.str.decodeBase64(dataUri.split(',')[1]);
    else
        byteString = decodeURIComponent(dataUri.split(',')[1]);

    //Note: Separate out the mime component
    var mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];

    //NOTE: Write the bytes of the string to a typed array
    var unitArray = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        unitArray[i] = byteString.charCodeAt(i);
    }
    return new Blob([unitArray], {type:mimeString});
}



//NOTE: Needed for get exif data
function get_exif_data(image_result)
{
    var data = image_result.replace(/data:image\/.*;base64,/, "");
    var decoded_data = $.str.decodeBase64(data);

    getLongAt = function(iOffset, bBigEndian) {
                var iByte1 = decoded_data.charCodeAt(iOffset),
                    iByte2 = decoded_data.charCodeAt(iOffset + 1),
                    iByte3 = decoded_data.charCodeAt(iOffset + 2),
                    iByte4 = decoded_data.charCodeAt(iOffset + 3);

                var iLong = bBigEndian ?
                    (((((iByte1 << 8) + iByte2) << 8) + iByte3) << 8) + iByte4
                    : (((((iByte4 << 8) + iByte3) << 8) + iByte2) << 8) + iByte1;
                if (iLong < 0) iLong += 4294967296;
                return iLong;
            };

    getSLongAt = function(iOffset, bBigEndian) {
        var iULong = getLongAt(iOffset, bBigEndian);
        if (iULong > 2147483647)
            return iULong - 4294967296;
        else
            return iULong;
    };

    var result = EXIF.readFromBinaryFile({
        getByteAt: function(idx) { return decoded_data.charCodeAt(idx); },
        getLength: function() { return decoded_data.length; },
        getShortAt: function(iOffset, bBigEndian) {
                var iShort = bBigEndian ?
                    (decoded_data.charCodeAt(iOffset) << 8) + decoded_data.charCodeAt(iOffset + 1)
                    : (decoded_data.charCodeAt(iOffset + 1) << 8) + decoded_data.charCodeAt(iOffset)
                if (iShort < 0) iShort += 65536;
                return iShort;
            },
        getStringAt: function(a, b) { return decoded_data.substring(a, a+b); },
        getLongAt: getLongAt,
        getSLongAt: getSLongAt
    });
    return result;
}

//EXIF
/*
* Javascript EXIF Reader 0.1.6
* Copyright (c) 2008 Jacob Seidelin, jseidelin@nihilogic.dk, http://blog.nihilogic.dk/
* Licensed under the MPL License [http://www.nihilogic.dk/licenses/mpl-license.txt]
*/
var EXIF = (function() {
var debug = false;
var ExifTags = {
// version tags
0x9000: "ExifVersion", // EXIF version
0xA000: "FlashpixVersion", // Flashpix format version
// colorspace tags
0xA001: "ColorSpace", // Color space information tag
// image configuration
0xA002: "PixelXDimension", // Valid width of meaningful image
0xA003: "PixelYDimension", // Valid height of meaningful image
0x9101: "ComponentsConfiguration", // Information about channels
0x9102: "CompressedBitsPerPixel", // Compressed bits per pixel
// user information
0x927C: "MakerNote", // Any desired information written by the manufacturer
0x9286: "UserComment", // Comments by user
// related file
0xA004: "RelatedSoundFile", // Name of related sound file
// date and time
0x9003: "DateTimeOriginal", // Date and time when the original image was generated
0x9004: "DateTimeDigitized", // Date and time when the image was stored digitally
0x9290: "SubsecTime", // Fractions of seconds for DateTime
0x9291: "SubsecTimeOriginal", // Fractions of seconds for DateTimeOriginal
0x9292: "SubsecTimeDigitized", // Fractions of seconds for DateTimeDigitized
// picture-taking conditions
0x829A: "ExposureTime", // Exposure time (in seconds)
0x829D: "FNumber", // F number
0x8822: "ExposureProgram", // Exposure program
0x8824: "SpectralSensitivity", // Spectral sensitivity
0x8827: "ISOSpeedRatings", // ISO speed rating
0x8828: "OECF", // Optoelectric conversion factor
0x9201: "ShutterSpeedValue", // Shutter speed
0x9202: "ApertureValue", // Lens aperture
0x9203: "BrightnessValue", // Value of brightness
0x9204: "ExposureBias", // Exposure bias
0x9205: "MaxApertureValue", // Smallest F number of lens
0x9206: "SubjectDistance", // Distance to subject in meters
0x9207: "MeteringMode", // Metering mode
0x9208: "LightSource", // Kind of light source
0x9209: "Flash", // Flash status
0x9214: "SubjectArea", // Location and area of main subject
0x920A: "FocalLength", // Focal length of the lens in mm
0xA20B: "FlashEnergy", // Strobe energy in BCPS
0xA20C: "SpatialFrequencyResponse", //
0xA20E: "FocalPlaneXResolution", // Number of pixels in width direction per FocalPlaneResolutionUnit
0xA20F: "FocalPlaneYResolution", // Number of pixels in height direction per FocalPlaneResolutionUnit
0xA210: "FocalPlaneResolutionUnit", // Unit for measuring FocalPlaneXResolution and FocalPlaneYResolution
0xA214: "SubjectLocation", // Location of subject in image
0xA215: "ExposureIndex", // Exposure index selected on camera
0xA217: "SensingMethod", // Image sensor type
0xA300: "FileSource", // Image source (3 == DSC)
0xA301: "SceneType", // Scene type (1 == directly photographed)
0xA302: "CFAPattern", // Color filter array geometric pattern
0xA401: "CustomRendered", // Special processing
0xA402: "ExposureMode", // Exposure mode
0xA403: "WhiteBalance", // 1 = auto white balance, 2 = manual
0xA404: "DigitalZoomRation", // Digital zoom ratio
0xA405: "FocalLengthIn35mmFilm", // Equivalent foacl length assuming 35mm film camera (in mm)
0xA406: "SceneCaptureType", // Type of scene
0xA407: "GainControl", // Degree of overall image gain adjustment
0xA408: "Contrast", // Direction of contrast processing applied by camera
0xA409: "Saturation", // Direction of saturation processing applied by camera
0xA40A: "Sharpness", // Direction of sharpness processing applied by camera
0xA40B: "DeviceSettingDescription", //
0xA40C: "SubjectDistanceRange", // Distance to subject
// other tags
0xA005: "InteroperabilityIFDPointer",
0xA420: "ImageUniqueID" // Identifier assigned uniquely to each image
};
var TiffTags = {
0x0100: "ImageWidth",
0x0101: "ImageHeight",
0x8769: "ExifIFDPointer",
0x8825: "GPSInfoIFDPointer",
0xA005: "InteroperabilityIFDPointer",
0x0102: "BitsPerSample",
0x0103: "Compression",
0x0106: "PhotometricInterpretation",
0x0112: "Orientation",
0x0115: "SamplesPerPixel",
0x011C: "PlanarConfiguration",
0x0212: "YCbCrSubSampling",
0x0213: "YCbCrPositioning",
0x011A: "XResolution",
0x011B: "YResolution",
0x0128: "ResolutionUnit",
0x0111: "StripOffsets",
0x0116: "RowsPerStrip",
0x0117: "StripByteCounts",
0x0201: "JPEGInterchangeFormat",
0x0202: "JPEGInterchangeFormatLength",
0x012D: "TransferFunction",
0x013E: "WhitePoint",
0x013F: "PrimaryChromaticities",
0x0211: "YCbCrCoefficients",
0x0214: "ReferenceBlackWhite",
0x0132: "DateTime",
0x010E: "ImageDescription",
0x010F: "Make",
0x0110: "Model",
0x0131: "Software",
0x013B: "Artist",
0x8298: "Copyright"
};
var GPSTags = {
0x0000: "GPSVersionID",
0x0001: "GPSLatitudeRef",
0x0002: "GPSLatitude",
0x0003: "GPSLongitudeRef",
0x0004: "GPSLongitude",
0x0005: "GPSAltitudeRef",
0x0006: "GPSAltitude",
0x0007: "GPSTimeStamp",
0x0008: "GPSSatellites",
0x0009: "GPSStatus",
0x000A: "GPSMeasureMode",
0x000B: "GPSDOP",
0x000C: "GPSSpeedRef",
0x000D: "GPSSpeed",
0x000E: "GPSTrackRef",
0x000F: "GPSTrack",
0x0010: "GPSImgDirectionRef",
0x0011: "GPSImgDirection",
0x0012: "GPSMapDatum",
0x0013: "GPSDestLatitudeRef",
0x0014: "GPSDestLatitude",
0x0015: "GPSDestLongitudeRef",
0x0016: "GPSDestLongitude",
0x0017: "GPSDestBearingRef",
0x0018: "GPSDestBearing",
0x0019: "GPSDestDistanceRef",
0x001A: "GPSDestDistance",
0x001B: "GPSProcessingMethod",
0x001C: "GPSAreaInformation",
0x001D: "GPSDateStamp",
0x001E: "GPSDifferential"
};
var StringValues = {
ExposureProgram: {
0: "Not defined",
1: "Manual",
2: "Normal program",
3: "Aperture priority",
4: "Shutter priority",
5: "Creative program",
6: "Action program",
7: "Portrait mode",
8: "Landscape mode"
},
MeteringMode: {
0: "Unknown",
1: "Average",
2: "CenterWeightedAverage",
3: "Spot",
4: "MultiSpot",
5: "Pattern",
6: "Partial",
255: "Other"
},
LightSource: {
0: "Unknown",
1: "Daylight",
2: "Fluorescent",
3: "Tungsten (incandescent light)",
4: "Flash",
9: "Fine weather",
10: "Cloudy weather",
11: "Shade",
12: "Daylight fluorescent (D 5700 - 7100K)",
13: "Day white fluorescent (N 4600 - 5400K)",
14: "Cool white fluorescent (W 3900 - 4500K)",
15: "White fluorescent (WW 3200 - 3700K)",
17: "Standard light A",
18: "Standard light B",
19: "Standard light C",
20: "D55",
21: "D65",
22: "D75",
23: "D50",
24: "ISO studio tungsten",
255: "Other"
},
Flash: {
0x0000: "Flash did not fire",
0x0001: "Flash fired",
0x0005: "Strobe return light not detected",
0x0007: "Strobe return light detected",
0x0009: "Flash fired, compulsory flash mode",
0x000D: "Flash fired, compulsory flash mode, return light not detected",
0x000F: "Flash fired, compulsory flash mode, return light detected",
0x0010: "Flash did not fire, compulsory flash mode",
0x0018: "Flash did not fire, auto mode",
0x0019: "Flash fired, auto mode",
0x001D: "Flash fired, auto mode, return light not detected",
0x001F: "Flash fired, auto mode, return light detected",
0x0020: "No flash function",
0x0041: "Flash fired, red-eye reduction mode",
0x0045: "Flash fired, red-eye reduction mode, return light not detected",
0x0047: "Flash fired, red-eye reduction mode, return light detected",
0x0049: "Flash fired, compulsory flash mode, red-eye reduction mode",
0x004D: "Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected",
0x004F: "Flash fired, compulsory flash mode, red-eye reduction mode, return light detected",
0x0059: "Flash fired, auto mode, red-eye reduction mode",
0x005D: "Flash fired, auto mode, return light not detected, red-eye reduction mode",
0x005F: "Flash fired, auto mode, return light detected, red-eye reduction mode"
},
SensingMethod: {
1: "Not defined",
2: "One-chip color area sensor",
3: "Two-chip color area sensor",
4: "Three-chip color area sensor",
5: "Color sequential area sensor",
7: "Trilinear sensor",
8: "Color sequential linear sensor"
},
SceneCaptureType: {
0: "Standard",
1: "Landscape",
2: "Portrait",
3: "Night scene"
},
SceneType: {
1: "Directly photographed"
},
CustomRendered: {
0: "Normal process",
1: "Custom process"
},
WhiteBalance: {
0: "Auto white balance",
1: "Manual white balance"
},
GainControl: {
0: "None",
1: "Low gain up",
2: "High gain up",
3: "Low gain down",
4: "High gain down"
},
Contrast: {
0: "Normal",
1: "Soft",
2: "Hard"
},
Saturation: {
0: "Normal",
1: "Low saturation",
2: "High saturation"
},
Sharpness: {
0: "Normal",
1: "Soft",
2: "Hard"
},
SubjectDistanceRange: {
0: "Unknown",
1: "Macro",
2: "Close view",
3: "Distant view"
},
FileSource: {
3: "DSC"
},
Components: {
0: "",
1: "Y",
2: "Cb",
3: "Cr",
4: "R",
5: "G",
6: "B"
}
};
function addEvent(element, event, handler) {
if (element.addEventListener) {
element.addEventListener(event, handler, false);
} else if (element.attachEvent) {
element.attachEvent("on" + event, handler);
}
}
function imageHasData(img) {
return !!(img.exifdata);
}
function getImageData(img, callback) {
BinaryAjax(img.src, function(http) {
var data = findEXIFinJPEG(http.binaryResponse);
img.exifdata = data || {};
if (callback) {
callback.call(img)
}
});
}
function findEXIFinJPEG(file) {
if (file.getByteAt(0) != 0xFF || file.getByteAt(1) != 0xD8) {
return false; // not a valid jpeg
}
var offset = 2,
length = file.getLength(),
marker;
while (offset < length) {
if (file.getByteAt(offset) != 0xFF) {
if (debug)
console.log("Not a valid marker at offset " + offset + ", found: " + file.getByteAt(offset));
return false; // not a valid marker, something is wrong
}
marker = file.getByteAt(offset + 1);
// we could implement handling for other markers here,
// but we're only looking for 0xFFE1 for EXIF data
if (marker == 22400) {
if (debug)
console.log("Found 0xFFE1 marker");
return readEXIFData(file, offset + 4, file.getShortAt(offset + 2, true) - 2);
// offset += 2 + file.getShortAt(offset+2, true);
} else if (marker == 225) {
// 0xE1 = Application-specific 1 (for EXIF)
if (debug)
console.log("Found 0xFFE1 marker");
return readEXIFData(file, offset + 4, file.getShortAt(offset + 2, true) - 2);
} else {
offset += 2 + file.getShortAt(offset + 2, true);
}
}
}
function readTags(file, tiffStart, dirStart, strings, bigEnd) {
var entries = file.getShortAt(dirStart, bigEnd),
tags = {},
entryOffset, tag,
i;
for (i = 0; i < entries; i++) {
entryOffset = dirStart + i * 12 + 2;
tag = strings[file.getShortAt(entryOffset, bigEnd)];
if (!tag && debug)
console.log("Unknown tag: " + file.getShortAt(entryOffset, bigEnd));
tags[tag] = readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd);
}
return tags;
}
function readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd) {
var type = file.getShortAt(entryOffset + 2, bigEnd),
numValues = file.getLongAt(entryOffset + 4, bigEnd),
valueOffset = file.getLongAt(entryOffset + 8, bigEnd) + tiffStart,
offset,
vals, val, n,
numerator, denominator;
switch (type) {
case 1: // byte, 8-bit unsigned int
case 7: // undefined, 8-bit byte, value depending on field
if (numValues == 1) {
return file.getByteAt(entryOffset + 8, bigEnd);
} else {
offset = numValues > 4 ? valueOffset : (entryOffset + 8);
vals = [];
for (n = 0; n < numValues; n++) {
vals[n] = file.getByteAt(offset + n);
}
return vals;
}
case 2: // ascii, 8-bit byte
offset = numValues > 4 ? valueOffset : (entryOffset + 8);
return file.getStringAt(offset, numValues - 1);
case 3: // short, 16 bit int
if (numValues == 1) {
return file.getShortAt(entryOffset + 8, bigEnd);
} else {
offset = numValues > 2 ? valueOffset : (entryOffset + 8);
vals = [];
for (n = 0; n < numValues; n++) {
vals[n] = file.getShortAt(offset + 2 * n, bigEnd);
}
return vals;
}
case 4: // long, 32 bit int
if (numValues == 1) {
return file.getLongAt(entryOffset + 8, bigEnd);
} else {
vals = [];
for (var n = 0; n < numValues; n++) {
vals[n] = file.getLongAt(valueOffset + 4 * n, bigEnd);
}
return vals;
}
case 5: // rational = two long values, first is numerator, second is denominator
if (numValues == 1) {
numerator = file.getLongAt(valueOffset, bigEnd);
denominator = file.getLongAt(valueOffset + 4, bigEnd);
val = new Number(numerator / denominator);
val.numerator = numerator;
val.denominator = denominator;
return val;
} else {
vals = [];
for (n = 0; n < numValues; n++) {
numerator = file.getLongAt(valueOffset + 8 * n, bigEnd);
denominator = file.getLongAt(valueOffset + 4 + 8 * n, bigEnd);
vals[n] = new Number(numerator / denominator);
vals[n].numerator = numerator;
vals[n].denominator = denominator;
}
return vals;
}
case 9: // slong, 32 bit signed int
if (numValues == 1) {
return file.getSLongAt(entryOffset + 8, bigEnd);
} else {
vals = [];
for (n = 0; n < numValues; n++) {
vals[n] = file.getSLongAt(valueOffset + 4 * n, bigEnd);
}
return vals;
}
case 10: // signed rational, two slongs, first is numerator, second is denominator
if (numValues == 1) {
return file.getSLongAt(valueOffset, bigEnd) / file.getSLongAt(valueOffset + 4, bigEnd);
} else {
vals = [];
for (n = 0; n < numValues; n++) {
vals[n] = file.getSLongAt(valueOffset + 8 * n, bigEnd) / file.getSLongAt(valueOffset + 4 + 8 * n, bigEnd);
}
return vals;
}
}
}
function readEXIFData(file, start) {
if (file.getStringAt(start, 4) != "Exif") {
if (debug)
console.log("Not valid EXIF data! " + file.getStringAt(start, 4));
return false;
}
var bigEnd,
tags, tag,
exifData, gpsData,
tiffOffset = start + 6;
// test for TIFF validity and endianness
if (file.getShortAt(tiffOffset) == 0x4949) {
bigEnd = false;
} else if (file.getShortAt(tiffOffset) == 0x4D4D) {
bigEnd = true;
} else {
if (debug)
console.log("Not valid TIFF data! (no 0x4949 or 0x4D4D)");
return false;
}
if (file.getShortAt(tiffOffset + 2, bigEnd) != 0x002A) {
if (debug)
console.log("Not valid TIFF data! (no 0x002A)");
return false;
}
if (file.getLongAt(tiffOffset + 4, bigEnd) != 0x00000008) {
if (debug)
console.log("Not valid TIFF data! (First offset not 8)", file.getShortAt(tiffOffset + 4, bigEnd));
return false;
}
tags = readTags(file, tiffOffset, tiffOffset + 8, TiffTags, bigEnd);
if (tags.ExifIFDPointer) {
exifData = readTags(file, tiffOffset, tiffOffset + tags.ExifIFDPointer, ExifTags, bigEnd);
for (tag in exifData) {
switch (tag) {
case "LightSource" :
case "Flash" :
case "MeteringMode" :
case "ExposureProgram" :
case "SensingMethod" :
case "SceneCaptureType" :
case "SceneType" :
case "CustomRendered" :
case "WhiteBalance" :
case "GainControl" :
case "Contrast" :
case "Saturation" :
case "Sharpness" :
case "SubjectDistanceRange" :
case "FileSource" :
exifData[tag] = StringValues[tag][exifData[tag]];
break;
case "ExifVersion" :
case "FlashpixVersion" :
exifData[tag] = String.fromCharCode(exifData[tag][0], exifData[tag][1], exifData[tag][2], exifData[tag][3]);
break;
case "ComponentsConfiguration" :
exifData[tag] =
StringValues.Components[exifData[tag][0]]
+ StringValues.Components[exifData[tag][1]]
+ StringValues.Components[exifData[tag][2]]
+ StringValues.Components[exifData[tag][3]];
break;
}
tags[tag] = exifData[tag];
}
}
if (tags.GPSInfoIFDPointer) {
gpsData = readTags(file, tiffOffset, tiffOffset + tags.GPSInfoIFDPointer, GPSTags, bigEnd);
for (tag in gpsData) {
switch (tag) {
case "GPSVersionID" :
gpsData[tag] = gpsData[tag][0]
+ "." + gpsData[tag][1]
+ "." + gpsData[tag][2]
+ "." + gpsData[tag][3];
break;
}
tags[tag] = gpsData[tag];
}
}
return tags;
}
function getData(img, callback) {
if (!img.complete)
return false;
if (!imageHasData(img)) {
getImageData(img, callback);
} else {
if (callback) {
callback.call(img);
}
}
return true;
}
function getTag(img, tag) {
if (!imageHasData(img))
return;
return img.exifdata[tag];
}
function getAllTags(img) {
if (!imageHasData(img))
return {};
var a,
data = img.exifdata,
tags = {};
for (a in data) {
if (data.hasOwnProperty(a)) {
tags[a] = data[a];
}
}
return tags;
}
function pretty(img) {
if (!imageHasData(img))
return "";
var a,
data = img.exifdata,
strPretty = "";
for (a in data) {
if (data.hasOwnProperty(a)) {
if (typeof data[a] == "object") {
if (data[a] instanceof Number) {
strPretty += a + " : " + data[a] + " [" + data[a].numerator + "/" + data[a].denominator + "]\r\n";
} else {
strPretty += a + " : [" + data[a].length + " values]\r\n";
}
} else {
strPretty += a + " : " + data[a] + "\r\n";
}
}
}
return strPretty;
}
function readFromBinaryFile(file) {
return findEXIFinJPEG(file);
}
return {
readFromBinaryFile: readFromBinaryFile,
pretty: pretty,
getTag: getTag,
getAllTags: getAllTags,
getData: getData,
Tags: ExifTags,
TiffTags: TiffTags,
GPSTags: GPSTags,
StringValues: StringValues
};
})();