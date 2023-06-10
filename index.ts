import { Alg } from "cubing/alg";
import { writeFileSync } from "fs";
import { json2csv } from "json-2-csv";

type Sheet = {
  table: {
    rows: {
      c: {
        v?: string;
      }[];
    }[];
  };
}

type LetterPair = {
  firstLetter: string;
  secondLetter: string;
  data: string;
}

type FullLetterPair = {
  firstMainLetter: string;
  firstAlternateLetter: string;
  secondMainLetter: string;
  secondAlternateLetter: string;
  memo: string;
  edgeAlg: string;
  cornerAlg: string;
}

const SHEET_ID = "1NEYh8MeTqHwnwA4s_CAYBGWU76pqdlutxR0SA2hNZKk";

function parseMainLetter(letter: string): string {
  return letter?.substring(0, 1);
}

function parseAlternateLetter(letter: string): string {
  // e.g "A (CH)" -> "CH"
  const match = letter.match(/\((.+)\)/);
  return match ? match[1] : letter;;
}

async function fetchGoogleSheet(sheetName: string): Promise<LetterPair[]> {
  const apiURL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${sheetName}`;
  console.log(apiURL);
  const sheetReq = await fetch(apiURL);
  const sheetData = await sheetReq.text();

  const sheetTrimmed = sheetData
    .split("\n", 2)[1]
    .replace(/google.visualization.Query.setResponse\(|\);/g, "");
  
  const sheet: Sheet = JSON.parse(sheetTrimmed);
  const rows = sheet.table.rows.map(row => row.c.map(col => col?.v ?? ""));

  const firstLetters = rows[0].slice(1);
  const secondLetters = rows.map(row => row[0]).slice(1);

  const letterPairs: LetterPair[] = [];
  for (let f = 0; f < firstLetters.length; f++) {
    for (let s = 0; s < secondLetters.length; s++) {
      const firstLetter = firstLetters[f];
      const secondLetter = secondLetters[s];
      const data = rows[s+1][f+1];
      if (data) {
        letterPairs.push({ firstLetter, secondLetter, data });
      }
    }
  }

  return letterPairs;
}

(async () => {
  const audioPairs = await fetchGoogleSheet("Audio");
  const cornerPairs = await fetchGoogleSheet("UFR%20Corners");
  const edgePairs = await fetchGoogleSheet("UF%20Edges"); 

  const cornersParsed = cornerPairs.map(pair => ({
    firstLetter: parseMainLetter(pair.firstLetter),
    secondLetter: parseMainLetter(pair.secondLetter),
    data: pair.data,
  }));

  const edgesParsed = edgePairs.map(pair => ({
    firstLetter: parseMainLetter(pair.firstLetter),
    secondLetter: parseMainLetter(pair.secondLetter),
    data: pair.data,
  }));

  const actualPairs: FullLetterPair[] = audioPairs.map(audio => {
    const mainFirstLetter = parseMainLetter(audio.firstLetter);
    const mainSecondLetter = parseMainLetter(audio.secondLetter);

    let corner = cornersParsed.find(corner => corner.firstLetter === mainFirstLetter && corner.secondLetter === mainSecondLetter)?.data;
    let edge = edgesParsed.find(edge => edge.firstLetter === mainFirstLetter && edge.secondLetter === mainSecondLetter)?.data;

    if (!corner) {
      const invCorner = cornersParsed.find(corner => corner.firstLetter === mainSecondLetter && corner.secondLetter === mainFirstLetter);
      corner = new Alg(invCorner?.data ?? "").invert().toString()
    }

    if (!edge) {
      const invEdge = edgesParsed.find(edge => edge.firstLetter === mainSecondLetter && edge.secondLetter === mainFirstLetter);
      edge = new Alg(invEdge?.data ?? "").invert().toString()
    }

    return {
      firstMainLetter: mainFirstLetter,
      secondMainLetter: mainSecondLetter,
      firstAlternateLetter: parseAlternateLetter(audio.firstLetter),
      secondAlternateLetter: parseAlternateLetter(audio.secondLetter),
      memo: audio.data,
      edgeAlg: edge ?? "",
      cornerAlg: corner ?? "",
    }
  });

  // Debug file to check data
  writeFileSync("data.json", JSON.stringify(actualPairs, null, 2));

  // For import into Anki
  const csv = await json2csv(actualPairs, {
    delimiter: { field: ";" },
    prependHeader: false,
  });
  writeFileSync("data.csv", csv);

  // For import into Quizlet
  const quizletData = actualPairs.map(pair => `${pair.firstMainLetter}${pair.secondMainLetter}-${pair.memo}`).join(";");
  writeFileSync("data.txt", quizletData);
})();
