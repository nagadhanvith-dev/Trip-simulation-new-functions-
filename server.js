const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Default seeds to write on reset
const DEFAULT_SEEDS = {
  "users": {
    "dhanvith@gmail.com": {
      "name": "Dhanvith",
      "password": "password",
      "wallet": "0x71C4B449A62c125638541e2a9b3f3e1a8a7f0042",
      "bank": "HDFC Bank",
      "upiId": "dhanvith@trippay",
      "upiPin": "123456",
      "balance": 30000,
      "reputation": 95
    },
    "varsh@gmail.com": {
      "name": "Varsh R",
      "password": "password",
      "wallet": "0x53d2d1ce2b9f3e1a8a7f0042f9b3e1a8a7f0043a",
      "bank": "State Bank of India",
      "upiId": "varsh@trippay",
      "upiPin": "654321",
      "balance": 25000,
      "reputation": 82
    },
    "sneha@gmail.com": {
      "name": "Sneha Reddy",
      "password": "password",
      "wallet": "0x8a7f004271C4B449A62c125638541e2a9b3f3e1a",
      "bank": "ICICI Bank",
      "upiId": "sneha@trippay",
      "upiPin": "111111",
      "balance": 40000,
      "reputation": 90
    },
    "vikram@gmail.com": {
      "name": "Vikram Malhotra",
      "password": "password",
      "wallet": "0x932fa31df9b3e1a8a7f0042f9b3e1a8a7f0043c",
      "bank": "Axis Bank",
      "upiId": "vikram@trippay",
      "upiPin": "222222",
      "balance": 15000,
      "reputation": 88
    },
    "preeti@gmail.com": {
      "name": "Preeti Sen",
      "password": "password",
      "wallet": "0x3A9b3f3e1a8a7f0042f9b3e1a8a7f00430x71C4",
      "bank": "HDFC Bank",
      "upiId": "preeti@trippay",
      "upiPin": "333333",
      "balance": 50000,
      "reputation": 91
    }
  },
  "trips": {},
  "invitations": {}
};

// Helper: load DB
function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(raw);
        } catch (e) {
            console.error("Error reading/parsing db.json:", e);
            return DEFAULT_SEEDS;
        }
    }
    // Create seed file if missing
    saveDB(DEFAULT_SEEDS);
    return DEFAULT_SEEDS;
}

// Helper: save DB
function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Error writing database state to db.json:", e);
    }
}

// Server-side SHA256 helper
function sha256Node(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

// Server-side blockchain verification
function isChainValidServer(chain) {
    for (let i = 1; i < chain.length; i++) {
        const block = chain[i];
        const prevBlock = chain[i - 1];
        
        // Calculate hash
        const dataStr = JSON.stringify(block.data);
        const input = block.index + block.previousHash + block.timestamp + dataStr + block.nonce;
        const recalculated = sha256Node(input);
        
        if (block.hash !== recalculated) {
            return false;
        }
        if (block.previousHash !== prevBlock.hash) {
            return false;
        }
    }
    return true;
}

// ----------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------

app.post('/api/auth/signup', (req, res) => {
    const db = loadDB();
    const { name, email, password, bank, upiPin, wallet } = req.body;
    
    if (!name || !email || !password || !bank || !upiPin) {
        return res.status(400).json({ error: "Missing required fields for signup." });
    }
    
    if (db.users[email.toLowerCase()]) {
        return res.status(400).json({ error: "Email is already registered." });
    }
    
    const userWallet = wallet || '0x' + sha256Node(email).substring(0, 40);
    const username = email.split('@')[0];
    const upiId = `${username}@trippay`;
    
    const newUser = {
        name,
        password, // stored plain for mock demo simplicity
        wallet: userWallet,
        bank,
        upiId,
        upiPin,
        balance: 25000, // Seed starting balance
        reputation: 90
    };
    
    db.users[email.toLowerCase()] = newUser;
    saveDB(db);
    
    // Return user without password
    const { password: _, ...userSafe } = newUser;
    res.json({ success: true, user: { email, ...userSafe } });
});

app.post('/api/auth/login', (req, res) => {
    const db = loadDB();
    const { email, password } = req.body;
    
    const user = db.users[email.toLowerCase()];
    if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid email or password." });
    }
    
    const { password: _, ...userSafe } = user;
    res.json({ success: true, user: { email, ...userSafe } });
});

app.post('/api/auth/google-sso', (req, res) => {
    const db = loadDB();
    const { name, email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: "Missing email from Google credentials." });
    }
    
    let user = db.users[email.toLowerCase()];
    if (!user) {
        // Register Google user automatically with standard seed fields
        const username = email.split('@')[0];
        user = {
            name: name || username,
            password: 'sso-google-password',
            wallet: '0x' + sha256Node(email).substring(0, 40),
            bank: "HDFC Bank",
            upiId: `${username}@trippay`,
            upiPin: "123456",
            balance: 20000,
            reputation: 90
        };
        db.users[email.toLowerCase()] = user;
        saveDB(db);
    }
    
    const { password: _, ...userSafe } = user;
    res.json({ success: true, user: { email, ...userSafe } });
});

// ----------------------------------------
// TRIP AND BLOCKCHAIN ROUTES
// ----------------------------------------

// Create Trip
app.post('/api/trips/create', (req, res) => {
    const db = loadDB();
    const { creatorEmail, name, depositAmount, approvalThreshold, startDate, endDate } = req.body;
    
    if (!creatorEmail || !name || !depositAmount || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required fields to initialize trip." });
    }
    
    const creatorUser = db.users[creatorEmail.toLowerCase()];
    if (!creatorUser) {
        return res.status(404).json({ error: "Creator user profile not found." });
    }
    
    const tripId = 'TP-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Create standard genesis block
    const genesisData = {
        type: "GENESIS",
        description: `TripPay Chain Vault Initialized. ${name} Pool Setup.`,
        amount: 0,
        actor: "System",
        signature: "GENESIS_SIG_0x000000000000"
    };
    
    const timestampStr = new Date().toLocaleString();
    const nonce = 10;
    const input = "0" + "0" + timestampStr + JSON.stringify(genesisData) + nonce;
    const hash = sha256Node(input);
    
    const genesisBlock = {
        index: 0,
        timestamp: timestampStr,
        data: genesisData,
        previousHash: "0",
        nonce,
        hash,
        signature: "GENESIS_SIG_0x000000000000"
    };
    
    const newTrip = {
        id: tripId,
        name,
        depositAmount: parseInt(depositAmount),
        approvalThreshold: parseFloat(approvalThreshold || 0.7),
        startDate,
        endDate,
        status: "Pending", // waiting for deposits
        creator: creatorEmail.toLowerCase(),
        members: {
            [creatorEmail.toLowerCase()]: {
                name: creatorUser.name,
                wallet: creatorUser.wallet,
                status: "Pending", // Must also deposit their share to accept
                role: "Creator"
            }
        },
        proposals: [],
        activities: [
            {
                id: Date.now(),
                text: `Trip Vault initialized by ${creatorUser.name}.`,
                type: "general",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ],
        upiTransactions: [],
        chain: [genesisBlock],
        originalBlock2Backup: null,
        ledgerCompromised: false,
        destinations: [],
        media: []
    };
    
    db.trips[tripId] = newTrip;
    
    // Register creator deposit invitation key so they can deposit inside console
    const creatorKey = `TP-CREATOR-DEPOSIT-${tripId}`;
    db.invitations[creatorKey] = {
        tripId,
        email: creatorEmail.toLowerCase(),
        wallet: creatorUser.wallet.toLowerCase()
    };
    
    saveDB(db);
    res.json({ success: true, tripId });
});

// Get user trips
app.get('/api/trips/my-trips', (req, res) => {
    const db = loadDB();
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ error: "Missing user email." });
    }
    
    const userEmail = email.toLowerCase();
    const userTrips = [];
    
    // Find all trips where the user is a member
    for (const id in db.trips) {
        const trip = db.trips[id];
        if (trip.members[userEmail]) {
            userTrips.push({
                id: trip.id,
                name: trip.name,
                status: trip.status,
                startDate: trip.startDate,
                endDate: trip.endDate,
                depositAmount: trip.depositAmount,
                membersCount: Object.keys(trip.members).length,
                members: Object.values(trip.members).map(m => m.name)
            });
        }
    }
    
    res.json({ success: true, trips: userTrips });
});

// Get trip details
app.get('/api/trips/details', (req, res) => {
    const db = loadDB();
    const { tripId } = req.query;
    if (!tripId) {
        return res.status(400).json({ error: "Missing tripId." });
    }
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    // Add reputation from the user table to the members response dynamically
    const enrichedMembers = {};
    for (const email in trip.members) {
        const u = db.users[email];
        enrichedMembers[email] = {
            ...trip.members[email],
            reputation: u ? u.reputation : 90
        };
    }
    
    res.json({
        success: true,
        trip: {
            ...trip,
            members: enrichedMembers
        }
    });
});

// Generate Invite Key
app.post('/api/trips/invite', (req, res) => {
    const db = loadDB();
    const { tripId, friendEmail, friendWallet } = req.body;
    
    if (!tripId || !friendEmail || !friendWallet) {
        return res.status(400).json({ error: "Missing tripId, friendEmail, or friendWallet details." });
    }
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    const emailLower = friendEmail.toLowerCase();
    
    // Generate secure Join Key
    const hashSeed = `${tripId}-${emailLower}-${friendWallet}-CREATOR-SECRET`;
    const hash = sha256Node(hashSeed).substring(0, 16);
    const joinKey = `TP-JOIN-HASH-${hash}`;
    
    // Register invite
    db.invitations[joinKey] = {
        tripId,
        email: emailLower,
        wallet: friendWallet.toLowerCase()
    };
    
    // Also add to trip members list as Pending
    // Extract name if user already registered, otherwise use email split
    const existingUser = db.users[emailLower];
    const friendName = existingUser ? existingUser.name : emailLower.split('@')[0];
    
    trip.members[emailLower] = {
        name: friendName,
        wallet: friendWallet.toLowerCase(),
        status: "Pending",
        role: "Member"
    };
    
    trip.activities.push({
        id: Date.now(),
        text: `Creator invited ${friendName} (Pending Deposit).`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true, joinKey });
});

// Verify Key and Join Trip
app.post('/api/trips/join', (req, res) => {
    const db = loadDB();
    const { joinKey, email, wallet, upiPin } = req.body;
    
    if (!joinKey || !email || !wallet || !upiPin) {
        return res.status(400).json({ error: "Missing verification parameters." });
    }
    
    const invite = db.invitations[joinKey];
    if (!invite || invite.email !== email.toLowerCase() || invite.wallet !== wallet.toLowerCase()) {
        return res.status(400).json({ error: "Invalid Join Key credentials." });
    }
    
    const user = db.users[email.toLowerCase()];
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }
    
    // Verify UPI PIN
    if (user.upiPin !== upiPin) {
        return res.status(401).json({ error: "Incorrect UPI PIN." });
    }
    
    const trip = db.trips[invite.tripId];
    if (!trip) {
        return res.status(404).json({ error: "Linked trip not found." });
    }
    
    if (user.balance < trip.depositAmount) {
        return res.status(400).json({ error: "Insufficient bank balance to complete deposit." });
    }
    
    // Execute transfer
    user.balance -= trip.depositAmount;
    trip.members[email.toLowerCase()].status = "Accepted";
    
    // Add UPI transaction log
    const refNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const timestampStr = new Date().toLocaleString();
    
    trip.upiTransactions.push({
        id: refNo,
        description: `Deposit Locked: ${user.name}`,
        amount: trip.depositAmount,
        type: "DEPOSIT",
        from: user.upiId,
        to: "vault@trippay",
        bank: user.bank,
        timestamp: timestampStr
    });
    
    // Add a block to the chain representing the deposit
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "DEPOSIT_MEMBER",
        description: `Deposit confirmed for ${user.name}.`,
        amount: trip.depositAmount,
        actor: user.name,
        signature: `SIG_secp256k1_0x${email.split('@')[0].substring(0, 3)}d71ce2a9b3f3e1a`
    };
    
    // Sim mining block
    const nonce = 5;
    const dataStr = JSON.stringify(blockData);
    const input = blockIndex + latestBlock.hash + timestampStr + dataStr + nonce;
    const hash = sha256Node(input);
    
    const newBlock = {
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    };
    
    trip.chain.push(newBlock);
    
    // If block index is 2, backup it up to support the tamper simulation restore
    if (blockIndex === 2) {
        trip.originalBlock2Backup = JSON.parse(JSON.stringify(newBlock));
    }
    
    trip.activities.push({
        id: Date.now(),
        text: `${user.name} deposited ₹${trip.depositAmount} successfully. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    // Check if everyone accepted
    let allAccepted = true;
    for (const emailKey in trip.members) {
        if (trip.members[emailKey].status !== "Accepted") {
            allAccepted = false;
            break;
        }
    }
    
    if (allAccepted) {
        trip.status = "Active";
        trip.activities.push({
            id: Date.now() + 1,
            text: `All deposits verified. Trip Vault activated.`,
            type: "general",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        
        // Mine an active launcher block
        const lastBlock = trip.chain[trip.chain.length - 1];
        const activeIdx = trip.chain.length;
        const activeData = {
            type: "DEPOSIT_POOL",
            description: "All deposits confirmed. Total pool locked in Trip Vault.",
            amount: Object.keys(trip.members).length * trip.depositAmount,
            actor: "System",
            signature: "SIG_secp256k1_0xsys21980b7ed71ce2a9b3f22d"
        };
        const activeInput = activeIdx + lastBlock.hash + timestampStr + JSON.stringify(activeData) + 8;
        const activeHash = sha256Node(activeInput);
        
        trip.chain.push({
            index: activeIdx,
            timestamp: timestampStr,
            data: activeData,
            previousHash: lastBlock.hash,
            nonce: 8,
            hash: activeHash,
            signature: activeData.signature
        });
    }
    
    // Delete the invitation code to prevent multiple joins
    delete db.invitations[joinKey];
    
    saveDB(db);
    res.json({ success: true, tripId: trip.id });
});

// Direct member vault deposit inside dashboard console
app.post('/api/trips/deposit', (req, res) => {
    const db = loadDB();
    const { tripId, email, upiPin } = req.body;
    
    if (!tripId || !email || !upiPin) {
        return res.status(400).json({ error: "Missing parameters for deposit." });
    }
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    const emailLower = email.toLowerCase();
    const member = trip.members[emailLower];
    if (!member) {
        return res.status(400).json({ error: "User is not a member of this trip." });
    }
    
    if (member.status === "Accepted") {
        return res.status(400).json({ error: "Deposit already paid." });
    }
    
    const user = db.users[emailLower];
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }
    
    if (user.upiPin !== upiPin) {
        return res.status(401).json({ error: "Incorrect UPI PIN." });
    }
    
    if (user.balance < trip.depositAmount) {
        return res.status(400).json({ error: "Insufficient bank balance to complete deposit." });
    }
    
    // Execute transfer
    user.balance -= trip.depositAmount;
    member.status = "Accepted";
    
    // Add UPI transaction log
    const refNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const timestampStr = new Date().toLocaleString();
    
    trip.upiTransactions.push({
        id: refNo,
        description: `Deposit Locked: ${user.name}`,
        amount: trip.depositAmount,
        type: "DEPOSIT",
        from: user.upiId,
        to: `vault-${tripId.toLowerCase()}@trippay`,
        bank: user.bank,
        timestamp: timestampStr
    });
    
    // Add a block to the chain representing the deposit
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "DEPOSIT_MEMBER",
        description: `Deposit confirmed for ${user.name}.`,
        amount: trip.depositAmount,
        actor: user.name,
        signature: `SIG_secp256k1_0x${emailLower.split('@')[0].substring(0, 3)}d71ce2a9b3f3e1a`
    };
    
    // Sim mining block
    const nonce = 5;
    const dataStr = JSON.stringify(blockData);
    const input = blockIndex + latestBlock.hash + timestampStr + dataStr + nonce;
    const hash = sha256Node(input);
    
    const newBlock = {
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    };
    
    trip.chain.push(newBlock);
    
    // If block index is 2, backup it up to support the tamper simulation restore
    if (blockIndex === 2) {
        trip.originalBlock2Backup = JSON.parse(JSON.stringify(newBlock));
    }
    
    trip.activities.push({
        id: Date.now(),
        text: `${user.name} deposited ₹${trip.depositAmount} successfully. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    // Check if everyone accepted
    let allAccepted = true;
    for (const emailKey in trip.members) {
        if (trip.members[emailKey].status !== "Accepted") {
            allAccepted = false;
            break;
        }
    }
    
    if (allAccepted) {
        trip.status = "Active";
        trip.activities.push({
            id: Date.now() + 1,
            text: `All deposits verified. Trip Vault activated.`,
            type: "general",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        
        // Mine an active launcher block
        const lastBlock = trip.chain[trip.chain.length - 1];
        const activeIdx = trip.chain.length;
        const activeData = {
            type: "DEPOSIT_POOL",
            description: "All deposits confirmed. Total pool locked in Trip Vault.",
            amount: Object.keys(trip.members).length * trip.depositAmount,
            actor: "System",
            signature: "SIG_secp256k1_0xsys21980b7ed71ce2a9b3f22d"
        };
        const activeInput = activeIdx + lastBlock.hash + timestampStr + JSON.stringify(activeData) + 8;
        const activeHash = sha256Node(activeInput);
        
        trip.chain.push({
            index: activeIdx,
            timestamp: timestampStr,
            data: activeData,
            previousHash: lastBlock.hash,
            nonce: 8,
            hash: activeHash,
            signature: activeData.signature
        });
    }
    
    saveDB(db);
    res.json({ success: true });
});

// Propose Expense
app.post('/api/trips/propose', (req, res) => {
    const db = loadDB();
    const { tripId, proposerEmail, title, amount, category, type, signature } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (trip.ledgerCompromised) {
        return res.status(400).json({ error: "Vault operations frozen. Ledger integrity compromised." });
    }
    
    const user = db.users[proposerEmail.toLowerCase()];
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }
    
    const propId = Date.now();
    const votes = {};
    for (const email in trip.members) {
        votes[email] = (email === proposerEmail.toLowerCase()) ? "approve" : "pending";
    }
    
    const newProposal = {
        id: propId,
        title,
        amount: parseInt(amount),
        category,
        type, // standard or emergency
        proposer: proposerEmail.toLowerCase(),
        status: (type === 'emergency') ? 'APPROVED' : 'PENDING',
        votes,
        signature,
        createdAt: propId
    };
    
    trip.proposals.push(newProposal);
    trip.activities.push({
        id: Date.now(),
        text: `New proposal submitted: ${title} (₹${amount}) by ${user.name}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    // If emergency, execute and mine block immediately
    if (type === 'emergency') {
        const latestBlock = trip.chain[trip.chain.length - 1];
        const blockIndex = trip.chain.length;
        const timestampStr = new Date().toLocaleString();
        
        const blockData = {
            type: "EXPENSE",
            description: `EMERGENCY: ${title}`,
            amount: parseInt(amount),
            category,
            actor: user.name,
            signature
        };
        
        const nonce = 12;
        const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
        const hash = sha256Node(input);
        
        trip.chain.push({
            index: blockIndex,
            timestamp: timestampStr,
            data: blockData,
            previousHash: latestBlock.hash,
            nonce,
            hash,
            signature
        });
        
        // Add UPI transaction log
        trip.upiTransactions.push({
            id: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
            description: `EMERGENCY: ${title}`,
            amount: parseInt(amount),
            type: "EXPENSE",
            from: "vault@trippay",
            to: `merchant-${category.toLowerCase()}@pay`,
            bank: "HDFC Bank",
            timestamp: timestampStr
        });
        
        trip.activities.push({
            id: Date.now() + 1,
            text: `Emergency fund released instantly. mined Block #${blockIndex}.`,
            type: "general",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }
    
    saveDB(db);
    res.json({ success: true, proposalId: propId });
});

// Vote on Proposal
app.post('/api/trips/vote', (req, res) => {
    const db = loadDB();
    const { tripId, proposalId, voterEmail, vote } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (trip.ledgerCompromised) {
        return res.status(400).json({ error: "Vault operations frozen. Ledger integrity compromised." });
    }
    
    const proposal = trip.proposals.find(p => p.id === parseInt(proposalId));
    if (!proposal) {
        return res.status(404).json({ error: "Proposal not found." });
    }
    
    const voterUser = db.users[voterEmail.toLowerCase()];
    if (!voterUser) {
        return res.status(404).json({ error: "Voter not found." });
    }
    
    proposal.votes[voterEmail.toLowerCase()] = vote;
    
    trip.activities.push({
        id: Date.now(),
        text: `${voterUser.name} cast ${vote.toUpperCase()} on '${proposal.title}'`,
        type: "vote",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    // Compute consensus
    let approves = 0;
    let rejects = 0;
    const totalMembers = Object.keys(trip.members).length;
    
    for (const email in proposal.votes) {
        if (proposal.votes[email] === 'approve') approves++;
        if (proposal.votes[email] === 'reject') rejects++;
    }
    
    const thresholdCount = Math.ceil(trip.approvalThreshold * totalMembers);
    
    if (proposal.status === 'PENDING') {
        if (approves >= thresholdCount) {
            proposal.status = 'APPROVED';
            
            // Mine standard expense block
            const latestBlock = trip.chain[trip.chain.length - 1];
            const blockIndex = trip.chain.length;
            const timestampStr = new Date().toLocaleString();
            
            const blockData = {
                type: "EXPENSE",
                description: proposal.title,
                amount: proposal.amount,
                category: proposal.category,
                actor: db.users[proposal.proposer].name,
                signature: proposal.signature
            };
            
            const nonce = 15;
            const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
            const hash = sha256Node(input);
            
            trip.chain.push({
                index: blockIndex,
                timestamp: timestampStr,
                data: blockData,
                previousHash: latestBlock.hash,
                nonce,
                hash,
                signature: proposal.signature
            });
            
            // Add UPI transaction log
            trip.upiTransactions.push({
                id: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
                description: proposal.title,
                amount: proposal.amount,
                type: "EXPENSE",
                from: "vault@trippay",
                to: `merchant-${proposal.category.toLowerCase()}@pay`,
                bank: "HDFC Bank",
                timestamp: timestampStr
            });
            
            trip.activities.push({
                id: Date.now() + 1,
                text: `Proposal '${proposal.title}' APPROVED. mined Block #${blockIndex}`,
                type: "general",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } else if (rejects > (totalMembers - thresholdCount)) {
            proposal.status = 'REJECTED';
            trip.activities.push({
                id: Date.now() + 1,
                text: `Proposal '${proposal.title}' REJECTED by consensus.`,
                type: "general",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    }
    
    saveDB(db);
    res.json({ success: true });
});

// Settle & End Trip
app.post('/api/trips/settle', (req, res) => {
    const db = loadDB();
    const { tripId, creatorEmail } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (trip.creator !== creatorEmail.toLowerCase()) {
        return res.status(403).json({ error: "Only the trip creator can settle the vault." });
    }
    
    if (trip.status === "Settled") {
        return res.status(400).json({ error: "Trip is already settled." });
    }
    
    // Calculate total pool
    const memberCount = Object.keys(trip.members).length;
    const totalPool = memberCount * trip.depositAmount;
    
    // Compute total spent from approved proposals
    let totalSpent = 0;
    trip.proposals.forEach(p => {
        if (p.status === 'APPROVED') {
            totalSpent += p.amount;
        }
    });
    
    const remaining = totalPool - totalSpent;
    const refundShare = Math.floor(remaining / memberCount);
    
    // Distribute refunds back to user bank balances
    for (const email in trip.members) {
        const u = db.users[email];
        if (u) {
            u.balance += refundShare;
            
            // Add refund UPI transaction log
            const refNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            trip.upiTransactions.push({
                id: refNo,
                description: `Vault Refund: ${u.name}`,
                amount: refundShare,
                type: "REFUND",
                from: "vault@trippay",
                to: u.upiId,
                bank: u.bank,
                timestamp: new Date().toLocaleString()
            });
        }
    }
    
    // Mine SETTLEMENT block on chain
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const timestampStr = new Date().toLocaleString();
    
    const blockData = {
        type: "SETTLEMENT",
        description: `Trip Settle Refund Complete. Total Pool: ₹${totalPool}, Total Spent: ₹${totalSpent}, Refunded Share: ₹${refundShare}`,
        amount: remaining,
        actor: "System",
        signature: "SIG_secp256k1_0xsys21980b7ed71ce2a9b3f22d"
    };
    
    const nonce = 22;
    const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
    const hash = sha256Node(input);
    
    trip.chain.push({
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    });
    
    trip.status = "Settled";
    trip.activities.push({
        id: Date.now(),
        text: `Trip Settle refund distribution mined. Block #${blockIndex}. Trip Status: Settled.`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// Simulator: Tamper Block #2
app.post('/api/trips/tamper', (req, res) => {
    const db = loadDB();
    const { tripId } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (trip.chain.length < 3) {
        return res.status(400).json({ error: "Not enough blocks to perform tamper demonstration." });
    }
    
    // Modify block #2 description and amount
    const block2 = trip.chain[2];
    block2.data.description = "Tampered fraudulent transaction description";
    block2.data.amount = 99999;
    
    trip.ledgerCompromised = true;
    trip.activities.push({
        id: Date.now(),
        text: "ALERT: Cryptographic ledger block #2 data tampered directly in memory!",
        type: "event-compromise",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// Simulator: Restore Block #2
app.post('/api/trips/restore', (req, res) => {
    const db = loadDB();
    const { tripId } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (!trip.originalBlock2Backup) {
        return res.status(400).json({ error: "No original backup block found to restore." });
    }
    
    // Restore
    trip.chain[2] = JSON.parse(JSON.stringify(trip.originalBlock2Backup));
    trip.ledgerCompromised = false;
    trip.activities.push({
        id: Date.now(),
        text: "Ledger restored successfully using backup blocks. Integrity verified.",
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// Emergency repayment / refund route due to ledger compromise
app.post('/api/trips/repay', (req, res) => {
    const db = loadDB();
    const { tripId, email, upiPin } = req.body;
    
    if (!tripId || !email || !upiPin) {
        return res.status(400).json({ error: "Missing parameters for repayment." });
    }
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (!trip.ledgerCompromised) {
        return res.status(400).json({ error: "Repayment only allowed for compromised vaults." });
    }
    
    const emailLower = email.toLowerCase();
    const member = trip.members[emailLower];
    if (!member) {
        return res.status(400).json({ error: "User is not a member of this trip." });
    }
    
    if (member.status !== "Accepted") {
        return res.status(400).json({ error: "Repayment not possible. User deposit is not locked." });
    }
    
    const user = db.users[emailLower];
    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }
    
    if (user.upiPin !== upiPin) {
        return res.status(401).json({ error: "Incorrect UPI PIN." });
    }
    
    // Execute refund: return deposit amount to user's bank balance
    user.balance += trip.depositAmount;
    member.status = "Refunded";
    
    // Add UPI log
    const refNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const timestampStr = new Date().toLocaleString();
    
    trip.upiTransactions.push({
        id: refNo,
        description: `Emergency Repayment: ${user.name}`,
        amount: trip.depositAmount,
        type: "REFUND",
        from: `vault-${tripId.toLowerCase()}@trippay`,
        to: user.upiId,
        bank: user.bank,
        timestamp: timestampStr
    });
    
    // Mine block representing emergency repayment
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "EMERGENCY_REPAYMENT",
        description: `Emergency deposit repayment processed for ${user.name} due to security lockdown.`,
        amount: trip.depositAmount,
        actor: user.name,
        signature: `SIG_secp256k1_0x${emailLower.split('@')[0].substring(0, 3)}d71ce2a9b3f3e1a`
    };
    
    const nonce = 12;
    const dataStr = JSON.stringify(blockData);
    const input = blockIndex + latestBlock.hash + timestampStr + dataStr + nonce;
    const hash = sha256Node(input);
    
    trip.chain.push({
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    });
    
    trip.activities.push({
        id: Date.now(),
        text: `Emergency refund of ₹${trip.depositAmount} processed for ${user.name}. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// Add suggestion place to itinerary map
app.post('/api/trips/add-destination', (req, res) => {
    const db = loadDB();
    const { tripId, name, lat, lng, notes, addedBy } = req.body;
    
    if (!tripId || !name || !lat || !lng || !addedBy) {
        return res.status(400).json({ error: "Missing required fields to suggest place." });
    }
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    // Fallback initialize if undefined
    if (!trip.destinations) {
        trip.destinations = [];
    }
    
    const destId = 'DST-' + Date.now();
    const newDest = {
        id: destId,
        name,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        notes: notes || "",
        addedBy,
        isNext: false,
        visited: false
    };
    
    trip.destinations.push(newDest);
    
    // Mine block
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "ADD_DESTINATION",
        description: `Suggested place "${name}" added to itinerary by ${addedBy}.`,
        amount: 0,
        actor: addedBy,
        signature: `SIG_secp256k1_0xmap21d71ce2a9b3f3e1a`
    };
    
    const timestampStr = new Date().toLocaleString();
    const nonce = 15;
    const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
    const hash = sha256Node(input);
    
    trip.chain.push({
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    });
    
    trip.activities.push({
        id: Date.now(),
        text: `${addedBy} suggested place: ${name}. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true, destination: newDest });
});

// Set active next destination
app.post('/api/trips/set-next-destination', (req, res) => {
    const db = loadDB();
    const { tripId, destinationId } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (!trip.destinations) {
        return res.status(400).json({ error: "No destinations found." });
    }
    
    let targetDest = null;
    trip.destinations.forEach(d => {
        if (d.id === destinationId) {
            d.isNext = true;
            d.visited = false;
            targetDest = d;
        } else {
            d.isNext = false;
        }
    });
    
    if (!targetDest) {
        return res.status(404).json({ error: "Destination not found." });
    }
    
    // Mine block representing setting next destination
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "SET_NEXT_DESTINATION",
        description: `Next destination set to "${targetDest.name}".`,
        amount: 0,
        actor: "System",
        signature: `SIG_secp256k1_0xsysnextd71ce2a9b3f3e1a`
    };
    
    const timestampStr = new Date().toLocaleString();
    const nonce = 16;
    const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
    const hash = sha256Node(input);
    
    trip.chain.push({
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    });
    
    trip.activities.push({
        id: Date.now(),
        text: `Next destination set to: ${targetDest.name}. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// Toggle visited state
app.post('/api/trips/toggle-visited-destination', (req, res) => {
    const db = loadDB();
    const { tripId, destinationId } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (!trip.destinations) {
        return res.status(400).json({ error: "No destinations found." });
    }
    
    let targetDest = null;
    trip.destinations.forEach(d => {
        if (d.id === destinationId) {
            d.visited = !d.visited;
            if (d.visited) {
                d.isNext = false;
            }
            targetDest = d;
        }
    });
    
    if (!targetDest) {
        return res.status(404).json({ error: "Destination not found." });
    }
    
    // Mine block representing visiting destination
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "VISITED_DESTINATION",
        description: `Destination "${targetDest.name}" marked as ${targetDest.visited ? 'Visited' : 'Not Visited'}.`,
        amount: 0,
        actor: "System",
        signature: `SIG_secp256k1_0xsysvisd71ce2a9b3f3e1a`
    };
    
    const timestampStr = new Date().toLocaleString();
    const nonce = 17;
    const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
    const hash = sha256Node(input);
    
    trip.chain.push({
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    });
    
    trip.activities.push({
        id: Date.now(),
        text: `Destination "${targetDest.name}" marked as ${targetDest.visited ? 'visited' : 'active'}. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// Upload shared trip media (base64)
app.post('/api/trips/upload-media', (req, res) => {
    const db = loadDB();
    const { tripId, name, type, caption, uploadedBy, dataUrl } = req.body;
    
    if (!tripId || !name || !type || !uploadedBy || !dataUrl) {
        return res.status(400).json({ error: "Missing required fields to upload media." });
    }
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    if (!trip.media) {
        trip.media = [];
    }
    
    const mediaId = 'MED-' + Date.now();
    const newMedia = {
        id: mediaId,
        name,
        type,
        caption: caption || "Captured during trip",
        uploadedBy,
        dataUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    trip.media.push(newMedia);
    
    // Mine block representing media upload
    const latestBlock = trip.chain[trip.chain.length - 1];
    const blockIndex = trip.chain.length;
    const blockData = {
        type: "UPLOAD_MEDIA",
        description: `${uploadedBy} uploaded a new ${type.split('/')[0]} to the gallery: "${newMedia.caption}".`,
        amount: 0,
        actor: uploadedBy,
        signature: `SIG_secp256k1_0xmed21d71ce2a9b3f3e1a`
    };
    
    const timestampStr = new Date().toLocaleString();
    const nonce = 18;
    const input = blockIndex + latestBlock.hash + timestampStr + JSON.stringify(blockData) + nonce;
    const hash = sha256Node(input);
    
    trip.chain.push({
        index: blockIndex,
        timestamp: timestampStr,
        data: blockData,
        previousHash: latestBlock.hash,
        nonce,
        hash,
        signature: blockData.signature
    });
    
    trip.activities.push({
        id: Date.now(),
        text: `${uploadedBy} uploaded shared media: ${newMedia.caption}. mined Block #${blockIndex}`,
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true, media: newMedia });
});

// Simulator: Pass 24 Hours
app.post('/api/trips/pass-time', (req, res) => {
    const db = loadDB();
    const { tripId } = req.body;
    
    const trip = db.trips[tripId];
    if (!trip) {
        return res.status(404).json({ error: "Trip not found." });
    }
    
    let expiredEmergency = false;
    
    // Check for any emergency proposals that haven't been resolved within 24h
    trip.proposals.forEach(p => {
        if (p.type === 'emergency' && p.status === 'APPROVED') {
            // Check approvals
            let approvals = 0;
            const totalMembers = Object.keys(trip.members).length;
            for (const email in p.votes) {
                if (p.votes[email] === 'approve') approvals++;
            }
            
            const threshold = Math.ceil(trip.approvalThreshold * totalMembers);
            if (approves < threshold) {
                p.status = 'REJECTED';
                expiredEmergency = true;
                
                // Deduct proposer's reputation
                const proposer = db.users[p.proposer];
                if (proposer) {
                    proposer.reputation = Math.max(0, proposer.reputation - 20);
                }
                
                trip.activities.push({
                    id: Date.now() + Math.random(),
                    text: `Emergency proposal '${p.title}' failed post-approval consensus! Proposer reputation penalized -20 points.`,
                    type: "event-compromise",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        }
    });
    
    trip.activities.push({
        id: Date.now(),
        text: "Time simulation: 24 hours passed. Checked emergency vote windows.",
        type: "general",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    saveDB(db);
    res.json({ success: true });
});

// API: Reset server database state
app.post('/api/reset', (req, res) => {
    saveDB(DEFAULT_SEEDS);
    console.log("Database reset triggered: db.json reverted to default seeds.");
    res.json({ success: true });
});

// ----------------------------------------
// WEB SERVER RUNNING
// ----------------------------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`TripPay Chain Simulator running at:`);
    console.log(`http://localhost:${PORT}`);
    console.log(`==================================================`);
});
