# Insurance Fraud Detection AI System

A comprehensive AI-powered fraud detection system for insurance claims with machine learning analysis, network analysis, and image processing capabilities.

## 🚀 Features

- **AI Fraud Detection**: Machine learning models for 7 insurance types (automobile, crop, health, life, personal_accident, property, travel)
- **Business Rules Engine**: Dynamic scoring based on claim-to-coverage ratios and other risk factors
- **Gemini AI Integration**: Enhanced fraud analysis with natural language explanations
- **Network Analysis**: Fraud ring detection using Neo4j graph database
- **Image Processing**: OCR text extraction and CNN image verification using EasyOCR
- **Real-time Dashboard**: Admin dashboard with claim management and analytics
- **User Portal**: Claim submission with document upload and status tracking

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **Neo4j Database** (for network analysis)
- **Firebase Project** (for database and storage)
- **Gemini AI API Key** (for enhanced fraud analysis)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd insurance-fraud-ai
```

### 2. Frontend Setup (Next.js)

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your Firebase configuration
# Add your Firebase config and other environment variables
```

**Required Environment Variables (.env.local):**
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# API Configuration
NEXT_PUBLIC_ML_API_URL=http://localhost:5000

# Gemini AI Configuration (for enhanced fraud analysis)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Neo4j Configuration (for network analysis)
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
```

### 3. Backend Setup (Python Flask API)

```bash
# Create virtual environment
 py -3.12 -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r api_requirements.txt

```

### 4. Gemini AI Setup

1. **Get Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a new project or use existing one
   - Generate an API key
   - Add it to your `.env.local` file

2. **Configure Gemini Model**:
   - Default model: `gemini-2.0-flash-exp`
   - You can change this in `.env.local` if needed

### 5. Neo4j Database Setup

1. **Install Neo4j Desktop** or **Neo4j Community Edition**
2. **Create a new database** (default name: `neo4j`)
3. **Start the database** and note the connection details
4. **Set up authentication** (username: `neo4j`, password: your choice)

### 6. Firebase Setup

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com)
2. **Enable Authentication** (Email/Password)
3. **Create Firestore Database** (in test mode)
4. **Enable Storage** for image uploads
5. **Add your web app** and copy the configuration to `.env.local`

## 🚀 Running the Application

### 1. Start the Flask API Server

```bash
# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Start the API server
python api_server.py
```

**Note**: The `app.py` file is used for model training and development with gradio interface. For production, only run `api_server.py`.

**Expected Output:**
```
Loading models and analyzing preprocessors...
Available insurance types: ['automobile', 'crop', 'health', 'life', 'personal_accident', 'property', 'travel']
Loading vision models...
✅ EasyOCR loaded (English + Hindi support)
🚀 Starting Flask server...
* Running on http://0.0.0.0:5000
✅ Fraud ring detection initialized
```

### 2. Start the Next.js Frontend

```bash
# In a new terminal
npm run dev
```

**Expected Output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- info Loaded env from .env.local
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **API Health Check**: http://localhost:5000/api/health
- **Admin Dashboard**: http://localhost:3000/admin-dashboard
- **Network Analysis**: http://localhost:3000/admin-dashboard/network-analysis

## 📁 Project Structure

```
insurance-fraud-ai/
├── app/                          # Next.js app directory
│   ├── admin-dashboard/          # Admin dashboard pages
│   ├── api/                      # Next.js API routes
│   └── dashboard/                # User dashboard pages
├── components/                   # React components
│   ├── admindashboard/          # Admin-specific components
│   └── ui/                      # Reusable UI components
├── lib/                         # Utility libraries
│   ├── fraudDetectionAPI.ts     # ML API integration
│   └── utils.ts                 # Helper functions
├── models/                      # ML model files
├── api_server.py               # Flask API server
├── fraud_ring_detection.py     # Neo4j network analysis
├── vision_services.py          # Image processing (OCR/CNN)
├── api_requirements.txt        # Python dependencies
├── neo4j_requirements.txt      # Neo4j dependencies
└── README.md                   # This file
```

## 🔧 Configuration

### ML Models
The system uses pre-trained models for 7 insurance types. Models are automatically loaded from the `models/` directory.

### Business Rules
Dynamic fraud scoring based on:
- **Claim-to-Coverage Ratio**: >150% triggers high fraud probability
- **Policy Age**: New policies (<30 days) are riskier
- **Filing Delay**: Immediate claims after incident are suspicious
- **Previous Claims**: Multiple claims increase risk

### Gemini AI Integration
Enhanced fraud analysis using Google's Gemini AI:
- **Natural Language Explanations**: Human-readable fraud analysis
- **Contextual Insights**: Detailed reasoning for fraud scores
- **Risk Assessment**: Comprehensive risk evaluation
- **On-Demand Analysis**: Available in claim details modal

### Network Analysis
Fraud ring detection using:
- **Phone Networks**: Shared phone numbers
- **Location Networks**: Same addresses
- **Policy Networks**: Related policy IDs
- **Rapid Filers**: Multiple claims in short time

## 🧪 Testing

### API Health Check
```bash
curl http://localhost:5000/api/health
```

### Test ML Prediction
```bash
curl -X POST http://localhost:5000/predict_fraud \
  -H "Content-Type: application/json" \
  -d '{"insurance_type": "health", "claim_amount": 100000, "sum_insured": 500000}'
```

### Test Network Analysis
```bash
curl -X POST http://localhost:5000/api/fraud-rings/detect \
  -H "Content-Type: application/json" \
  -d '{"users": [], "policies": [], "claims": []}'
```

## 🐛 Troubleshooting

### Common Issues

1. **"ModuleNotFoundError: No module named 'easyocr'"**
   ```bash
   # Ensure you're in the virtual environment
   venv\Scripts\activate
   pip install easyocr
   ```

2. **"Analysis pending" in admin dashboard**
   - Check if Flask server is running on port 5000
   - Verify API health at http://localhost:5000/api/health
   - Check browser console for error messages

3. **Neo4j connection failed**
   - Ensure Neo4j database is running
   - Check connection details in `.env.local`
   - Verify firewall settings

4. **Memory allocation errors**
   - Close other applications to free RAM
   - Consider using a machine with more memory
   - The vision models require significant RAM

5. **Firebase authentication errors**
   - Verify Firebase configuration in `.env.local`
   - Check if Authentication is enabled in Firebase console
   - Ensure Firestore rules allow read/write access

6. **Gemini AI errors**
   - Verify `GEMINI_API_KEY` is set in `.env.local`
   - Check if API key is valid at [Google AI Studio](https://aistudio.google.com/)
   - Ensure you have sufficient API quota
   - Check browser console for specific error messages

### Performance Optimization

- **For better OCR performance**: Use GPU-enabled PyTorch
- **For faster ML processing**: Consider using a more powerful CPU
- **For large datasets**: Increase Neo4j heap memory

## 📊 Usage

### Admin Dashboard
1. **View Claims**: See all submitted claims with fraud scores
2. **ML Analysis**: Detailed explanations of fraud predictions
3. **Gemini AI Analysis**: Enhanced natural language fraud insights
4. **Network Analysis**: Detect fraud rings and suspicious patterns
5. **Claim Management**: Approve/reject claims with comments

### User Dashboard
1. **Submit Claims**: Upload documents and incident photos
2. **Track Status**: Monitor claim processing progress
3. **View Results**: See fraud analysis and risk assessment
4. **AI Assistant**: Get help with claim submission process

## 🔒 Security

- **Environment Variables**: Never commit `.env.local` to version control
- **Firebase Rules**: Configure appropriate read/write permissions
- **API Endpoints**: Consider adding authentication for production
- **Neo4j**: Use strong passwords and network security

## 📈 Monitoring

- **API Health**: Monitor Flask server status
- **Database**: Check Firestore and Neo4j performance
- **Memory Usage**: Monitor system resources during ML processing
- **Error Logs**: Check browser console and server logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the console logs
3. Verify all services are running
4. Check environment variable configuration

---

**Note**: This system requires significant computational resources for ML processing. For production deployment, consider using cloud services with adequate memory and processing power.