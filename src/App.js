import React, { Component } from 'react';
import { format, eachDay } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import DatePicker from 'react-datepicker';
import { WithContext as ReactTags } from 'react-tag-input';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import logo from './images/logo.svg';
import loading from './images/loading.png';
import 'react-datepicker/dist/react-datepicker.css';
import './App.css';
import * as R from 'ramda';

const KeyCodes = {
  comma: 188,
  enter: 13
};

const delimiters = [KeyCodes.comma, KeyCodes.enter];

class App extends Component {
  state = {
    isLoading: false,
    lang: 'zh',
    startDay: '',
    endDay: '',
    inputStartDay: '',
    inputEndDay: '',
    myName: '',
    yourName: '',
    msgs: [],
    searchTerms: []
  };

  formatTime = timeString => {
    const { lang } = this.state;
    if (lang === 'en') {
      const pattern = /^(\d{2}:\d{2})/;
      const matchValues = pattern.exec(timeString);
      const formatString = `${matchValues[1]}`;
      return formatString;
    } else {
      const pattern = /^(上午|下午)(\d{2}:\d{2})/;
      const matchValues = pattern.exec(timeString);
      const ampm = (matchValues[1] = '上午' ? 'am' : 'pm');
      const formatString = `${matchValues[2]} ${ampm}`;
      return formatString;
    }
  };

  findMsgData = lineText => {
    const { myName, yourName, lang } = this.state;
    let pattern;
    if (lang === 'en') {
      pattern = new RegExp(
        `^(\\d{2}:\\d{2})\\s+(${myName}|${yourName})\\s+(.*)`
      );
    } else {
      pattern = new RegExp(
        `^((?:上午|下午)\\d{2}:\\d{2})\\s+(${myName}|${yourName})\\s+(.*)`
      );
    }
    const matchValues = pattern.exec(lineText);
    if (matchValues) {
      return {
        time: this.formatTime(matchValues[1]),
        userName: matchValues[2],
        msgText: matchValues[3]
      };
    }
  };

  findMsgDate = lineText => {
    const pattern = /^(?:[12]\d{3}(?:\/)(?:0[1-9]|1[0-2])(?:\/)(?:0[1-9]|[12]\d|3[01]))/;
    const matchValues = pattern.exec(lineText);
    if (matchValues) {
      return matchValues[0];
    }
  };

  reduceMsgDatas = msgs => {
    let lastDate;
    let lastTime;
    let lastUserName;
    let lastMergedMsgText;
    let pushLastOne = false;
    const msgDatas = [];
    msgs.forEach((msg, index) => {
      const date = this.findMsgDate(msg);
      const data = this.findMsgData(msg);
      if (date || data) {
        if (date) {
          const lastData = {
            id: index,
            date: lastDate,
            time: lastTime,
            userName: lastUserName,
            msgText: lastMergedMsgText
          };
          lastDate = date;
          if (pushLastOne) {
            msgDatas.push(lastData);
          }
          pushLastOne = false;
        }
        if (data) {
          const { time, userName, msgText } = data;
          const lastData = {
            id: index,
            date: lastDate,
            time: lastTime,
            userName: lastUserName,
            msgText: lastMergedMsgText
          };
          lastTime = time;
          lastUserName = userName;
          lastMergedMsgText = msgText;
          if (pushLastOne) {
            msgDatas.push(lastData);
          }
          pushLastOne = true;
        }
      } else if (msg !== '') {
        lastMergedMsgText = `${lastMergedMsgText} ${msg}`;
      }
    });
    return msgDatas;
  };

  mapformattedDateTime = object => {
    return {
      ...object,
      date: format(object.date, 'YYYY/MM/DD'),
      time: object.time
    };
  };

  handleFiles = files => {
    const file = files[0];
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const contents = fileReader.result;
      const lines = contents.split('\n');
      const modifiedMsgs = this.reduceMsgDatas(lines);
      const msgs = modifiedMsgs.map(this.mapformattedDateTime);
      this.setState({ msgs });
    };
    fileReader.readAsText(file);
  };

  onInputChange = (value, keyName) => {
    this.setState({ [keyName]: value });
  };

  onStartDayChange = date => {
    this.setState({
      inputStartDay: date
    });
  };

  onEndDayChange = date => {
    this.setState({
      inputEndDay: date
    });
  };

  returnAreaChartData = (originData = []) => {
    const { startDay, endDay, myName, yourName } = this.state;
    const filteredData = this.filterSearchTerm(originData);
    const { myData, yourData } = this.separateUserData(filteredData);
    const startDate =
      startDay === '' ? (originData[0] ? originData[0].date : '') : startDay;
    const endDate =
      endDay === ''
        ? originData[originData.length - 1]
          ? originData[originData.length - 1].date
          : ''
        : endDay;
    const eachDays = eachDay(startDate, endDate);
    const areaChartData = eachDays.map(date => {
      const formattedDate = format(date, 'YYYY/MM/DD');
      const array1 = myData.filter(day => day.date === formattedDate);
      const array2 = yourData.filter(day => day.date === formattedDate);
      return {
        date: formattedDate,
        [myName]: array1.length,
        [yourName]: array2.length
      };
    });
    return areaChartData;
  };

  filterSearchTerm = originData => {
    const { searchTerms } = this.state;
    let finalArray = [];
    if (searchTerms.length !== 0) {
      searchTerms.forEach(({ text }) => {
        const filteredData = originData.filter(({ msgText }) => {
          return msgText.includes(text);
        });
        finalArray = R.unionWith(
          R.eqBy(R.prop('id')),
          finalArray,
          filteredData
        );
      });
    } else {
      finalArray = originData;
    }
    return finalArray;
  };

  separateUserData = originData => {
    const { myName } = this.state;
    const myData = [];
    const yourData = [];
    originData.forEach(msg => {
      const { userName } = msg;
      if (userName === myName) {
        myData.push(msg);
      } else {
        yourData.push(msg);
      }
    });
    return {
      myData,
      yourData
    };
  };

  handleDelete = i => {
    const { searchTerms } = this.state;
    this.setState({
      searchTerms: searchTerms.filter((tag, index) => index !== i)
    });
  };

  handleAddition = tag => {
    const { searchTerms } = this.state;
    this.setState({
      searchTerms: [...searchTerms, tag]
    });
  };

  handleDrag = (tag, currPos, newPos) => {
    const searchTerms = [...this.state.searchTerms];
    const newTags = searchTerms.slice();

    newTags.splice(currPos, 1);
    newTags.splice(newPos, 0, tag);

    // re-render
    this.setState({ searchTerms: newTags });
  };

  render() {
    const {
      lang,
      inputStartDay,
      inputEndDay,
      myName,
      yourName,
      msgs,
      searchTerms,
      isLoading
    } = this.state;
    const areaChartData = this.returnAreaChartData(msgs);
    return (
      <>
        {isLoading ? (
          <div id="loading">
            <img src={loading} alt="loading" />
          </div>
        ) : null}
        <header id="header">
          <img src={logo} alt="logo" />
        </header>
        <div className="wrapper">
          <div className="select-group">
            <label htmlFor="selectLang">您的時間格式</label>
            <select
              id="selectLang"
              onChange={e => this.onInputChange(e.target.value, 'lang')}
              value={lang}
            >
              <option value="en">英: 1991/02/01, Fri</option>
              <option value="zh">中: 1991/02/01（五）</option>
            </select>
          </div>
          <div className="input-group">
            <label htmlFor="myName">Start Day</label>
            <div className="date-picker">
              <DatePicker
                dateFormat="yyyy/MM/dd"
                selected={this.state.inputStartDay}
                onChange={this.onStartDayChange}
              />
              <FontAwesomeIcon color="#909090" icon={faCalendarAlt} />
            </div>
            <div
              className="apply-btn"
              onClick={() => this.onInputChange(inputStartDay, 'startDay')}
            >
              Send
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="myName">End Day</label>
            <div className="date-picker">
              <DatePicker
                dateFormat="yyyy/MM/dd"
                selected={this.state.inputEndDay}
                onChange={this.onEndDayChange}
              />
              <FontAwesomeIcon color="#909090" icon={faCalendarAlt} />
            </div>
            <div
              className="apply-btn"
              onClick={() => this.onInputChange(inputEndDay, 'endDay')}
            >
              Send
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="myName">Username 1</label>
            <input
              id="myName"
              type="text"
              onChange={e => this.onInputChange(e.target.value, 'myName')}
              value={myName}
            />
          </div>
          <div className="input-group">
            <label htmlFor="myName">Username 2</label>
            <input
              type="text"
              id="yourName"
              onChange={e => this.onInputChange(e.target.value, 'yourName')}
              value={yourName}
            />
          </div>
          <div className="input-group">
            <label htmlFor="fileupload">LINE 對話記錄</label>
            <input
              id="fileupload"
              type="file"
              onChange={e => this.handleFiles(e.target.files)}
            />
          </div>
          <div className="searcher-wrapper">
            <div>輸入篩選關鍵字</div>
            <ReactTags
              tags={searchTerms}
              handleDelete={this.handleDelete}
              handleAddition={this.handleAddition}
              handleDrag={this.handleDrag}
              delimiters={delimiters}
            />
          </div>
          <div className="main-chart">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={areaChartData}>
                <Area
                  stackId="1"
                  type="monotone"
                  dataKey={myName}
                  stroke="#00EBE3"
                  fill="#00EBE3"
                />
                <Area
                  stackId="2"
                  type="monotone"
                  dataKey={yourName}
                  stroke="#EEC985"
                  fill="#EEC985"
                />
                <CartesianGrid
                  stroke="rgba(255, 255, 255, .05)"
                  vertical={false}
                />
                <XAxis dataKey="date" tickLine={false} />
                <YAxis orientation="right" axisLine={false} tickLine={false} />
                <Tooltip
                  wrapperStyle={{
                    borderRadius: '5px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 15px 40px 0 rgba(0, 0, 0, 0.11)'
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    );
  }
}

export default App;
