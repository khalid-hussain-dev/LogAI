"""
LogAI Shipper — pip-installable Python package for sending logs to LogAI.

Install:  pip install -e ./shipper
Usage:    from logai_shipper import LogAIShipper
"""

from setuptools import setup, find_packages

setup(
    name="logai-shipper",
    version="0.1.0",
    description="Python log shipper for LogAI platform",
    author="Navroz Salim",
    packages=find_packages(),
    install_requires=[],
    python_requires=">=3.8",
)
