'use client';
import { useState } from 'react';
import mammoth from 'mammoth';
import { parse } from 'json2csv';
import { UploadIcon, InformationCircleIcon } from '@heroicons/react/outline';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/outline';
import { FaGithub, FaLinkedin } from 'react-icons/fa';



const Home = () => {
  const [file, setFile] = useState(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  let metadataList;

  const [extractedText, setExtractedText] = useState([]);

  function toTitleCase(str) {
    return str
      .toLowerCase() // Convert the entire string to lowercase
      .split(' ') // Split the string into words
      .map(word => {
        // Capitalize the first letter and concatenate with the rest of the word
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' '); // Join the words back into a single string
  }


  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setDownloadMessage('');
    setExtractedText([]);
  };

  const handleSubmit = async (e) => {
    setDownloadMessage('')
    setErrorMessage('')
    e.preventDefault();

    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

      // Directly loop through the HTML and extract text
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const paragraphs = Array.from(doc.querySelectorAll('p')); // Select all <p> tags
      const orderedList = Array.from(doc.querySelectorAll('li')); // Select all <p> tags
      const textArray = paragraphs.map(p => p.innerText.trim()); // Store the text in an array
      const orderArray = orderedList.map(l => l.innerText.trim())
      textArray.push(...orderArray)
      console.log(textArray)
      setExtractedText(textArray); // Set the extracted text to state

      const { questions, metadata } = extractQuestionsAndMetadata(textArray);

      if (questions.length === 0) {
        throw new Error('No questions were extracted from the document.');
      }

      const csv = parse(questions); // Include specific fields
      const csvWithoutHeader = csv.split('\n').slice(1).join('\n');


      downloadCSV(csvWithoutHeader);

      // Set download message
      setDownloadMessage('CSV file has been successfully downloaded!');
      setFile(null)
    } catch (error) {
      console.error('Error processing the file:', error);
      setErrorMessage(`Error processing the file: ${error.message}`);
      setFile(null)
    }
  };

  const extractQuestionsAndMetadata = (textArray) => {
    const questions = [['question type', 'question group', 'question level', 'question', 'mark', 'option_1', 'option_2', 'option_3', 'option_4', 'answear']];
    let metadata = [];
    let readingQuestions = false;

    textArray.forEach((line, index) => {
      // Check for metadata lines
      const metaMatch = line.match(/^\[(.*?)\]$/);
      if (metaMatch) {
        const keyValue = metaMatch[1].split(':').map(item => item.trim());
        if (keyValue.length === 2) {
          const [key, value] = keyValue;
          metadata.push(value);
        }
        return; // Skip to next line
      }

      // Check for questions section
      if (line.trim().toLowerCase() === 'questions:') {
        readingQuestions = true;
        return; // Skip to next line
      }

      // If we are reading questions, process the question lines
      if (readingQuestions) {
        if (line) {
          const questionNumbered = line.match(/^(?:\d+\.\s*)?(.+)\s*\((.*?)\)$/);
          if (questionNumbered) {
            const question = questionNumbered[1].trim();
            const optionsString = questionNumbered[2].trim();
            const options = optionsString.split(',').map(option => option.trim());
            if (options.length === 4) {

              // Array to store formatted option indices for uppercase options
              const answerIndices = options.reduce((accumulator, option, index) => {
                if ((option === option.toUpperCase() && isNaN(option)) || option.startsWith('_')) {
                  accumulator.push(index); // Store just the index
                }
                return accumulator; // Return the updated array
              }, []);

              // Determine the output based on the number of uppercase options found
              let formattedAnswerIndices;
              let answer;
              let type;
              if (answerIndices.length > 1) {
                // More than one uppercase option, format as ["option_0", "option_2", ...]
                answer = `["${answerIndices.map(i => `option_${i + 1}`).join('","')}"]`;
                type = 'multi_choice'

              } else if (answerIndices.length === 1) {
                answer = 'option_' + (answerIndices[0] + 1)
                type = 'single_choice'
              } else {
                // No uppercase options found
                formattedAnswerIndices = [];
              }
              questions.push([
                type,
                metadata[2],
                metadata[3],
                question,
                +metadata[4] || 1,
                toTitleCase(options[0]).replace(/^_/, '') || '',
                toTitleCase(options[1]).replace(/^_/, '') || '',
                toTitleCase(options[2]).replace(/^_/, '') || '',
                toTitleCase(options[3]).replace(/^_/, '') || '',
                answer,
              ]);

            } else if (options.length === 2) {

              const answer = options.reduce((accumulator, option, index) => {
                if (option === option.toUpperCase()) {
                  accumulator.push(index); // Store just the index
                }
                return accumulator
              }, []);
              questions.push([
                'true_false',
                metadata[2],
                metadata[3],
                question,
                +metadata[4] || 1,
                '',
                '',
                '',
                '',
                options[answer[0]],
              ]);

            } else if (options.length === 1) {

              questions.push([
                'descriptive',
                metadata[2],
                metadata[3],
                question,
                +metadata[4] || 1,
                '',
                '',
                '',
                '',
                options[0],
              ]);

            }

            return; // Skip to next line
          }

        }
      }
    });
    metadataList = metadata



    return { questions, metadata };
  };

  const downloadCSV = (csv) => {
    console.log(metadataList)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '' + metadataList[0] + '_' + metadataList[1]);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">
          <InformationCircleIcon className="h-6 w-6 inline-block mr-2 text-blue-600" />
          Smadux Docx to CSV Converter
        </h1>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Question Formatting Instructions</h2>
        <p className="text-gray-700 mb-4">
          To ensure proper extraction and conversion of questions, please follow the formatting guidelines below:
        </p>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">1. Document Metadata</h3>
        <p className="text-gray-700 mb-4">
          At the top of your document, include the following metadata format:
        </p>
        <pre className="bg-gray-100 p-4 rounded mb-4 overflow-x-auto">
          <code className="text-gray-800">
            [class: &lt;class_name&gt;]<br />
            [subject: &lt;subject_name&gt;]<br />
            [question group: &lt;group_number&gt;]<br />
            [question level: &lt;level&gt;]<br />
            [mark: &lt;mark_value&gt;]
          </code>
        </pre>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">2. Questions Section</h3>
        <p className="text-gray-700 mb-4">
          Start a new line and indicate the beginning of the questions section with:
        </p>
        <pre className="bg-gray-100 p-4 rounded mb-4 overflow-x-auto">
          <code className="text-gray-800">
            questions:
          </code>
        </pre>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">3. Question Formatting</h3>
        <p className="text-gray-700 mb-4">
          - Each question should be on a new line.<br />
          - Use parentheses to specify the answer options.<br />
          - Correct answers must be in uppercase letters. <br />
          - if answer is a number or any answer that can't be capitalized, it should start with an underscore
        </p>
        <h4 className="text-lg font-semibold text-gray-800 mb-2">Question Types:</h4>
        <ul className="list-disc list-inside text-gray-700 mb-4">
          <li><strong>Single Choice:</strong> <code>Question text? (option_1, option_2, OPTION_3, option_4)</code></li>
          <li><strong>Multiple Choice:</strong> <code>Question text? (OPTION_1, option_2, OPTION_3, option_4)</code></li>
          <li><strong>True/False:</strong> <code>Question text? (true, FALSE)</code></li>
          <li><strong>Descriptive:</strong> <code>Question text?</code></li>
        </ul>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">4. File Format</h3>
        <p className="text-gray-700 mb-4">
          Save your document in either <code>.doc</code> or <code>.docx</code> format.
        </p>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Final Document Example</h3>
        <pre className="bg-gray-100 p-4 rounded mb-4 overflow-x-auto">
          <code className="text-gray-800">
            [class: kg1]<br />
            [subject: General]<br />
            [question group: 19]<br />
            [question level: Medium]<br />
            [mark: 2]<br />
            <br />
            questions:<br />
            1. Which animal is known as the king of the jungle? (Tiger, LION, Elephant, Bear)<br />
            2. stealing is good? (true, FALSE)<br />
            3. Pick all that are wild animals? (LION, dog, hen, TIGER)<br />
            4. ____ is the king of the jungle?(lion)<br />
            5. what is 2 + 4 (_6,9,12,7)<br />
            6. pick all even numbers (_2,_4,5,_6)
          </code>
        </pre>
        <p className="text-gray-700 mb-4">
          Following these guidelines will ensure accurate extraction and conversion of your questions into CSV format.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block mb-2 text-gray-700">
            Upload your Word Document:
          </label>
          <div className="flex items-center border border-gray-300 rounded-lg p-2 mb-4">
            <UploadIcon className="h-6 w-6 text-blue-500 mr-2" />
            <input
              type="file"
              accept=".doc,.docx"
              onChange={handleFileChange}
              className="flex-1 border-0 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition duration-200"
          >
            Upload and Convert
          </button>
        </form>
        {downloadMessage && (
          <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded" role="alert">
            <CheckCircleIcon className="w-5 h-5 inline-block mr-2" />
            {downloadMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-green-100 rounded" role="alert">
            <ExclamationCircleIcon className="w-5 h-5 inline-block mr-2" />
            {errorMessage}
          </div>
        )}
      </div>
      <footer className="bg-gray-800 text-white py-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <p className="text-sm">&copy; {new Date().getFullYear()} Developed by Jahrex (Rorobi Anthony)</p>
          <div className="flex space-x-4">
            <a
              href="https://github.com/Jahrexmac"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 flex items-center"
            >
              <FaGithub className="mr-1" /> GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/anthony-rorobi-22263b18b"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 flex items-center"
            >
              <FaLinkedin className="mr-1" /> LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Home;
