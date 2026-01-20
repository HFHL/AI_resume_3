import { Candidate, Job, Upload } from '@/types';

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    name: '张伟',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    title: '高级 Java 工程师',
    work_years: 6,
    degree: '硕士',
    phone: '138****1234',
    email: 'zhangwei@example.com',
    school: { name: '浙江大学', tags: ['985', '211', '双一流'] },
    company: '字节跳动 (ByteDance)',
    company_tags: ['互联网大厂', '独角兽'],
    is_outsourcing: false,
    location: '北京',
    skills: ['Java', 'Spring Boot', 'Microservices', 'Redis'],
    match_score: 95,
    last_active: '2小时前'
  },
  {
    id: 'c2',
    name: '李娜',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    title: 'Web3 产品经理',
    work_years: 3,
    degree: '本科',
    phone: '139****5678',
    email: 'lina@example.com',
    school: { name: '悉尼大学', tags: ['海外留学', 'QS Top50'] },
    company: 'Binance',
    company_tags: ['Web3交易所', 'Remote'],
    is_outsourcing: false,
    location: '上海',
    skills: ['DeFi', 'Tokenomics', 'Solidity', 'English'],
    match_score: 88,
    last_active: '刚刚'
  },
  {
    id: 'c3',
    name: '王强',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ryan',
    title: '前端开发工程师',
    work_years: 2,
    degree: '本科',
    phone: null,
    email: 'wangqiang@example.com',
    school: { name: '成都信息工程大学', tags: [] },
    company: '中软国际',
    company_tags: ['外包'],
    is_outsourcing: true,
    location: '成都',
    skills: ['React', 'Vue', 'TypeScript'],
    match_score: 65,
    last_active: '3天前'
  },
  {
    id: 'c4',
    name: 'Emily Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    title: '量化研究员',
    work_years: 4,
    degree: '博士',
    phone: '186****9999',
    email: 'emily@quant.fund',
    school: { name: '清华大学', tags: ['985', '211'] },
    company: '某知名量化私募',
    company_tags: ['量化金融'],
    is_outsourcing: false,
    location: '深圳',
    skills: ['Python', 'C++', 'Machine Learning', 'Alpha Strategy'],
    match_score: 98,
    last_active: '1天前'
  },
  {
    id: 'c5',
    name: '刘洋',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
    title: 'Go 后端开发',
    work_years: 8,
    degree: '本科',
    phone: '135****8888',
    email: 'liuyang@tech.com',
    school: { name: '电子科技大学', tags: ['985', '211'] },
    company: '腾讯科技',
    company_tags: ['互联网大厂'],
    is_outsourcing: false,
    location: '深圳',
    skills: ['Go', 'K8s', 'Docker', 'High Concurrency'],
    match_score: 92,
    last_active: '5小时前'
  }
];

export const MOCK_JOBS: Job[] = [
  {
    id: 'j1',
    title: '高级 Java 工程师',
    department: '基础架构部',
    match_mode: 'Any Match',
    keywords: ['Java', 'Microservices', 'High Concurrency'],
    status: 'Open',
    candidates_count: 12,
    updated_at: '2023-10-24'
  },
  {
    id: 'j2',
    title: 'Web3 产品经理',
    department: '交易业务线',
    match_mode: 'All Match',
    keywords: ['DeFi', 'Product Management', 'English'],
    status: 'Open',
    candidates_count: 5,
    updated_at: '2023-10-22'
  },
  {
    id: 'j3',
    title: '量化研究员 (Intern)',
    department: '资管部',
    match_mode: 'Any Match',
    keywords: ['Python', 'Math', 'Statistics'],
    status: 'Closed',
    candidates_count: 45,
    updated_at: '2023-09-15'
  }
];

export const MOCK_UPLOADS: Upload[] = [
  { id: 'u1', filename: '张伟_Java_简历.pdf', size: '2.4 MB', status: 'success', date: '2023-10-25 10:30' },
  { id: 'u2', filename: '李娜_PM_Resume.pdf', size: '1.8 MB', status: 'success', date: '2023-10-25 10:35' },
  { id: 'u3', filename: 'unknown_scan_001.pdf', size: '5.2 MB', status: 'failed', error: '文件损坏或加密', date: '2023-10-24 16:20' },
  { id: 'u4', filename: '王强_前端.docx', size: '0.8 MB', status: 'processing', date: '刚刚' },
  { id: 'u5', filename: 'Emily_Quant_CV.pdf', size: '1.2 MB', status: 'success', date: '2023-10-24 09:15' },
  { id: 'u6', filename: '刘洋_Golang.pdf', size: '3.1 MB', status: 'success', date: '2023-10-23 18:45' },
  { id: 'u7', filename: '陈某_测试开发.doc', size: '1.5 MB', status: 'failed', error: '格式不支持', date: '2023-10-23 14:20' },
];

export const AVAILABLE_TAGS = {
  tech: [
    // 技术栈
    'java', 'go', 'python', 'rust', 'c++',
    '后端', '前端', '全栈', '架构师', 'cto', 'sre',
    'android', '安卓', 'ios', 'flutter', 'cocos',
    '运维', '测试', 'dba', '数据开发', '数据分析',
    '区块链开发', '合约', 'solidity', '密码学', '安全',
    '量化开发', '量化策略',
    // AI
    'ai', 'ai agent', '大模型', '大语言模型', 'rag',
    '生成式ai', '多模态', '向量数据库', 'langchain', '智能体',
  ],
  business: [
    // 非技术
    '市场', '运营', '增长', 'cmo', 'pr', '公关', '销售', 'bd',
    '产品', '设计', '行政', '法务', '风控', '合规', 'devrel',
    '投资', '项目经理', '财务', '会计', '上币', 'listing',
    // Web3 交易
    '合约', '现货', '返佣', 'perp', 'perpetual', 'dex', 'defi',
    '质押', '借贷', 'lending', 'staking', 'restaking', '理财',
    // Web3 生态
    'evm', 'ethereum', 'eth', 'btc', 'solana', 'ton', 'tg生态',
    '波卡', 'polkadot', 'cosmos',
    // Web3 其他
    'layer1', 'layer2', 'zk', 'op', 'rollup', 'rpc', '钱包',
    '支付', 'amm', 'mev', '挖矿', 'tokenomics', '铭文', 'meme',
    '法币', 'c2c', 'did', 'indexer', '大客户', 'vip', '高净值',
    '家办', '机构',
    // 金融量化
    '做市', '交易', '低延迟', '套利', '回测', '订单簿', '撮合',
    '滑点', '流动性', '期权', '衍生品', '永续', '期货', '杠杆',
    '网格', '外汇', '日内', '波段',
  ]
};

