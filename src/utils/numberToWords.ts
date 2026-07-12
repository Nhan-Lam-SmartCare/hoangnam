const defaultNumbers = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

function readThreeDigits(bas: number, showZeroHundred: boolean): string {
  let hundred = Math.floor(bas / 100);
  let ten = Math.floor((bas % 100) / 10);
  let unit = bas % 10;
  let result = "";

  if (hundred > 0 || showZeroHundred) {
    result += defaultNumbers[hundred] + " trăm ";
  }

  if (ten > 0) {
    if (ten === 1) {
      result += "mười ";
    } else {
      result += defaultNumbers[ten] + " mươi ";
    }
  } else if (hundred > 0 || showZeroHundred) {
    if (unit > 0) {
      result += "lẻ ";
    }
  }

  if (unit > 0) {
    if (unit === 1 && ten > 1) {
      result += "mốt";
    } else if (unit === 5 && ten > 0) {
      result += "lăm";
    } else {
      result += defaultNumbers[unit];
    }
  }

  return result.trim();
}

export function numberToVietnameseWords(amount: number): string {
  if (amount === 0) return "Không đồng";
  
  let str = Math.round(amount).toString();
  let result = "";
  let groups: string[] = [];

  while (str.length > 0) {
    groups.push(str.slice(-3));
    str = str.slice(0, -3);
  }

  const units = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];

  for (let i = groups.length - 1; i >= 0; i--) {
    let num = parseInt(groups[i], 10);
    if (num > 0) {
      const showZeroHundred = i < groups.length - 1;
      let groupText = readThreeDigits(num, showZeroHundred);
      result += groupText + units[i] + " ";
    }
  }

  result = result.trim() + " đồng";
  return result.charAt(0).toUpperCase() + result.slice(1);
}
