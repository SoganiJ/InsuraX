"""
Setup script for Fraud Ring Detection
Installs dependencies and tests Neo4j connection
"""

import subprocess
import sys
import os

def install_dependencies():
    """Install required Python packages"""
    print("📦 Installing dependencies...")
    
    packages = [
        "neo4j==5.15.0",
        "networkx==3.2.1", 
        "python-dotenv"
    ]
    
    for package in packages:
        try:
            print(f"   Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            print(f"   ✅ {package} installed successfully")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Failed to install {package}: {e}")
            return False
    
    return True

def test_neo4j_connection():
    """Test Neo4j connection"""
    print("\n🔍 Testing Neo4j connection...")
    
    try:
        from neo4j import GraphDatabase
        
        # Load environment variables
        neo4j_uri = os.getenv('NEO4J_URI', 'neo4j://127.0.0.1:7687')
        neo4j_username = os.getenv('NEO4J_USERNAME', 'neo4j')
        neo4j_password = os.getenv('NEO4J_PASSWORD', 'Insurance@123')
        neo4j_database = os.getenv('NEO4J_DATABASE', 'neo4j')
        
        print(f"   URI: {neo4j_uri}")
        print(f"   Username: {neo4j_username}")
        print(f"   Database: {neo4j_database}")
        
        # Test connection
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
        session = driver.session(database=neo4j_database)
        
        # Test query
        result = session.run("RETURN 'Hello Neo4j!' as message")
        message = result.single()['message']
        
        print("   ✅ Connection successful!")
        print(f"   Response: {message}")
        
        # Close connection
        session.close()
        driver.close()
        
        return True
        
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return False

def create_env_file():
    """Create .env file with Neo4j credentials"""
    print("\n📝 Creating .env file...")
    
    env_content = """# Neo4j Configuration
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=Insurance@123
NEO4J_DATABASE=neo4j
"""
    
    try:
        with open('.env', 'w') as f:
            f.write(env_content)
        print("   ✅ .env file created successfully")
        return True
    except Exception as e:
        print(f"   ❌ Failed to create .env file: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Setting up Fraud Ring Detection System")
    print("=" * 50)
    
    # Step 1: Install dependencies
    if not install_dependencies():
        print("\n❌ Dependency installation failed. Please install manually:")
        print("   pip install neo4j==5.15.0 networkx==3.2.1 python-dotenv")
        return False
    
    # Step 2: Create .env file
    create_env_file()
    
    # Step 3: Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("   ✅ Environment variables loaded")
    except ImportError:
        print("   ⚠️ python-dotenv not available, using system environment")
    
    # Step 4: Test Neo4j connection
    if test_neo4j_connection():
        print("\n🎉 Setup completed successfully!")
        print("\n📋 Next steps:")
        print("   1. Make sure Neo4j is running")
        print("   2. Start the API server: python api_server.py")
        print("   3. The fraud ring detection will be available at:")
        print("      - POST /api/fraud-rings/detect")
        print("      - GET /api/fraud-rings/visualization")
        print("      - GET /api/fraud-rings/health")
        return True
    else:
        print("\n💡 Troubleshooting:")
        print("   1. Make sure Neo4j is running on port 7687")
        print("   2. Check your credentials in .env file")
        print("   3. Verify Neo4j is accessible from your machine")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)







