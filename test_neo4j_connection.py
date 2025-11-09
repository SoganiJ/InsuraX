"""
Test Neo4j connection with your credentials
"""

import os
from neo4j import GraphDatabase

def test_neo4j_connection():
    """Test Neo4j connection with environment variables"""
    
    # Load environment variables
    neo4j_uri = os.getenv('NEO4J_URI', 'neo4j://127.0.0.1:7687')
    neo4j_username = os.getenv('NEO4J_USERNAME', 'neo4j')
    neo4j_password = os.getenv('NEO4J_PASSWORD', 'Insurance@123')
    neo4j_database = os.getenv('NEO4J_DATABASE', 'neo4j')
    
    print("🔍 Testing Neo4j Connection...")
    print(f"   URI: {neo4j_uri}")
    print(f"   Username: {neo4j_username}")
    print(f"   Database: {neo4j_database}")
    print(f"   Password: {'*' * len(neo4j_password)}")
    
    try:
        # Test connection
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
        session = driver.session(database=neo4j_database)
        
        # Test query
        result = session.run("RETURN 'Hello Neo4j!' as message")
        message = result.single()['message']
        
        print("✅ Connection successful!")
        print(f"   Response: {message}")
        
        # Test database info
        result = session.run("CALL db.info()")
        db_info = result.single()
        print(f"   Database: {db_info['name']}")
        print(f"   Version: {db_info['version']}")
        
        # Close connection
        session.close()
        driver.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    # Load .env file if it exists
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("📁 Loaded .env file")
    except ImportError:
        print("⚠️ python-dotenv not installed, using system environment variables")
    
    success = test_neo4j_connection()
    
    if success:
        print("\n🎉 Neo4j is ready for fraud ring detection!")
        print("   You can now start the API server with fraud detection enabled.")
    else:
        print("\n💡 Troubleshooting tips:")
        print("   1. Make sure Neo4j is running")
        print("   2. Check your credentials in .env.local")
        print("   3. Verify the URI format (neo4j:// or bolt://)")
        print("   4. Check if the database exists")


